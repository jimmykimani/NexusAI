import { useEffect, useRef } from 'react'
import { buildSseUrl } from '@/api/client'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import type { StreamEvent } from '@/types'

/**
 * Opens a Server-Sent Events connection for the given session and dispatches
 * events to the search store. Closes automatically on `complete` or `error`.
 */
export function useSSE(sessionId: string | null): void {
  const addStreamEvent = useSearchStore((s) => s.addStreamEvent)
  const setLeads = useSearchStore((s) => s.setLeads)
  const refreshLeads = useSearchStore((s) => s.refreshLeadsFromServer)
  const setSearching = useSearchStore((s) => s.setSearching)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const showToast = useUIStore((s) => s.showToast)

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let es: EventSource | null = null

    async function connect() {
      const llm = useSearchStore.getState().streamLlmParams
      let llmSuffix = ''
      if (llm) {
        const p = new URLSearchParams()
        p.set('llm_provider', llm.provider)
        p.set('llm_reasoning_model', llm.reasoningModel)
        p.set('llm_fast_model', llm.fastModel)
        llmSuffix = `&${p.toString()}`
      }
      const url = await buildSseUrl(sessionId!, llmSuffix)
      if (llm) {
        useSearchStore.getState().setStreamLlmParams(null)
      }
      if (cancelled) return
      es = new EventSource(url)
      esRef.current = es
      es.onmessage = onMessage
      es.onerror = onError
    }

    function onMessage(e: MessageEvent) {
      try {
        const event = JSON.parse(e.data) as StreamEvent

        if (event.type === 'stream_end') {
          setSearching(false)
          es?.close()
          void loadSessions()
          if (sessionId) void refreshLeads(sessionId)
          return
        }

        if (event.type === 'meta' && event.data && 'elapsed_ms' in event.data) {
          useSearchStore.getState().setSearchTiming(event.data.elapsed_ms as number)
        } else {
          addStreamEvent(event)
        }

        if (event.type === 'complete' && event.data?.leads) {
          setLeads(event.data.leads)
          setSearching(false)
          void loadSessions()
        }

        if (event.type === 'error') {
          setSearching(false)
          es?.close()
          void loadSessions()
          showToast('error', event.message)
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err)
      }
    }

    function onError() {
      setSearching(false)
      es?.close()
    }

    void connect()

    return () => {
      cancelled = true
      es?.close()
      esRef.current = null
    }
  }, [sessionId, addStreamEvent, setLeads, refreshLeads, setSearching, loadSessions, showToast])
}
