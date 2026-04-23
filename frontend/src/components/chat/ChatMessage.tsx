import { PlanDisplay } from './PlanDisplay'
import type { StreamEvent } from '@/types'

/**
 * Renders a single stream event inline as flowing chat content:
 * - `plan` without data: italic "thinking" line with a paragraph of text.
 * - `plan` with data: a text intro + criteria chips + "step rows" for each query.
 * - `searching` / `found`: a paragraph of text.
 * - `ranking` / `complete`: a paragraph.
 * - `error`: red paragraph.
 */
export function ChatMessage({ event }: { event: StreamEvent }) {
  if (event.type === 'persona_chunk' || event.type === 'meta' || event.type === 'stream_end') {
    return null
  }

  if (event.type === 'error') {
    return <p className="text-sm text-red-400">{event.message}</p>
  }

  if (event.type === 'plan' && (event.data?.criteria || event.data?.queries)) {
    return (
      <div className="space-y-2">
        <p className="text-nexus-text">{event.message}</p>
        {event.data?.queries && event.data.queries.length > 0 && (
          <ul className="space-y-1.5">
            {event.data.queries.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-nexus-muted">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-nexus-accent/70 shrink-0" />
                <span className="text-sm">
                  <span className="text-nexus-subtle">Web Search</span>
                  <span className="mx-1.5 text-nexus-muted/60">|</span>
                  <span className="text-nexus-text">{q}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <PlanDisplay criteria={event.data?.criteria} />
      </div>
    )
  }

  return <p className="text-nexus-text">{event.message}</p>
}
