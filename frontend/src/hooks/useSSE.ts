import { useEffect, useRef } from 'react'
import { buildSseUrl } from '@/api/client'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import type { StreamEvent } from '@/types'

/**
 * Opens a Server-Sent Events connection for the given session and dispatches
 * events to the search store. Closes automatically on `complete` or `error`.
 */
export function useSSE(sessionId: string | null, streamEpoch: number): void {
  const addStreamEvent = useSearchStore((s) => s.addStreamEvent)
  const setLeads = useSearchStore((s) => s.setLeads)
  const refreshLeads = useSearchStore((s) => s.refreshLeadsFromServer)
  const setSearching = useSearchStore((s) => s.setSearching)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const patchThreadTurnStatus = useSearchStore((s) => s.patchThreadTurnStatus)
  const appendThreadTurnSummaryChunk = useSearchStore((s) => s.appendThreadTurnSummaryChunk)
  const setThreadTurnResultCount = useSearchStore((s) => s.setThreadTurnResultCount)
  const showToast = useUIStore((s) => s.showToast)

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let es: EventSource | null = null

    async function connect() {
      const state = useSearchStore.getState()
      const q = state.pendingQuery
      const llm = state.streamLlmParams
      const p = new URLSearchParams()
      if (llm) {
        p.set('llm_provider', llm.provider)
        p.set('llm_reasoning_model', llm.reasoningModel)
        p.set('llm_fast_model', llm.fastModel)
      }
      if (q) p.set('q', q)
      const llmSuffix = p.toString() ? `&${p.toString()}` : ''

      const url = await buildSseUrl(sessionId!, llmSuffix)
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

        if (event.type === 'persona_chunk' && event.data?.phase === 'outro' && event.data.text && sessionId) {
          appendThreadTurnSummaryChunk(sessionId, event.data.text)
        }

        if (event.type === 'found') {
          if (event.data?.leads) setLeads(event.data.leads)
        }

        if (event.type === 'complete') {
          if (event.data?.leads) setLeads(event.data.leads)
          if (sessionId && event.data?.leads) setThreadTurnResultCount(sessionId, event.data.leads.length)
          setSearching(false)
          if (sessionId) patchThreadTurnStatus(sessionId, 'complete')
          void loadSessions()
        }

        if (event.type === 'error') {
          setSearching(false)
          if (sessionId) patchThreadTurnStatus(sessionId, 'error')
          es?.close()
          void loadSessions()
          showToast('error', event.message)
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err)
      }
    }

    function onError(e: any) {
      console.error('SSE Error:', e)
      setSearching(false)
      showToast('error', 'Connection lost or server rebooting. Please refresh if this persists.')
      es?.close()
    }

    void connect()

    return () => {
      cancelled = true
      es?.close()
      esRef.current = null
    }
  }, [
    sessionId,
    streamEpoch,
    addStreamEvent,
    setLeads,
    refreshLeads,
    setSearching,
    loadSessions,
    patchThreadTurnStatus,
    appendThreadTurnSummaryChunk,
    setThreadTurnResultCount,
    showToast,
  ])
}
