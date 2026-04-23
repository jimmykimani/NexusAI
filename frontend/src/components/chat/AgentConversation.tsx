import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { useSearchStore } from '@/stores/searchStore'
import type { StreamEvent } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Renders streamed persona copy + technical agent steps. After `complete`,
 * technical steps move into a collapsed "Background" disclosure so the panel
 * stays calm like Lessie, while intro/outro persona remain visible.
 */
export function AgentConversation() {
  const events = useSearchStore((s) => s.streamEvents)
  const elapsedMs = useSearchStore((s) => s.lastSearchElapsedMs)

  const { intro, outro, technical, hasComplete } = useMemo(
    () => partitionStreamEvents(events),
    [events],
  )

  const timingLabel =
    elapsedMs != null && elapsedMs >= 0
      ? `${(elapsedMs / 1000).toFixed(1)}s`
      : null

  if (events.length === 0) return null

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {intro.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border border-nexus-border/80 bg-nexus-card/60 px-4 py-3',
            'text-[13px] text-nexus-text whitespace-pre-wrap',
          )}
        >
          {intro.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}

      {!hasComplete ? (
        <div className="space-y-3">
          {technical.map((event, i) => (
            <ChatMessage key={i} event={event} />
          ))}
        </div>
      ) : (
        <>
          <details className="group rounded-xl border border-nexus-border/70 bg-nexus-bg/40 overflow-hidden">
            <summary
              className={cn(
                'cursor-pointer select-none list-none flex items-center gap-2 px-3 py-2.5',
                'text-xs text-nexus-muted hover:text-nexus-subtle hover:bg-nexus-elevated/40',
                'transition-colors [&::-webkit-details-marker]:hidden',
              )}
            >
              <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" />
              <span>
                Background steps
                {timingLabel && (
                  <span className="text-nexus-muted/70"> · {timingLabel}</span>
                )}
              </span>
            </summary>
            <div className="px-3 pb-3 pt-0 space-y-3 border-t border-nexus-border/50">
              {technical.map((event, i) => (
                <ChatMessage key={i} event={event} />
              ))}
            </div>
          </details>

          {outro.length > 0 && (
            <div
              className={cn(
                'rounded-2xl border border-nexus-accent/25 bg-nexus-accent/[0.06] px-4 py-3',
                'text-[13px] text-nexus-text whitespace-pre-wrap',
              )}
            >
              {outro.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function partitionStreamEvents(events: StreamEvent[]) {
  const hasComplete = events.some((e) => e.type === 'complete')

  const introChunks: string[] = []
  const outroChunks: string[] = []
  let seenComplete = false

  for (const e of events) {
    if (e.type === 'complete') {
      seenComplete = true
      continue
    }
    if (e.type === 'persona_chunk') {
      const text = e.data?.text ?? ''
      if (e.data?.phase === 'outro') {
        if (seenComplete) outroChunks.push(text)
      } else {
        introChunks.push(text)
      }
      continue
    }
    if (e.type === 'meta') continue
  }

  const technical = events.filter((e) =>
    ['plan', 'searching', 'found', 'ranking', 'complete', 'error'].includes(e.type),
  )

  return {
    intro: introChunks,
    outro: outroChunks,
    technical,
    hasComplete,
  }
}
