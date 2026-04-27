import { CheckCircle2, Loader2, Search, Table } from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import type { StreamEvent } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Renders a single stream event inline as flowing chat content:
 * - `plan` with data: a compact intro + a few query rows.
 * - `complete`: an interactive pill that filters the results table to this search.
 * - `error`: red paragraph.
 */
export function ChatMessage({ event }: { event: StreamEvent }) {
  const setActiveResultQuery = useSearchStore((s) => s.setActiveResultQuery)
  const activeResultQuery = useSearchStore((s) => s.activeResultQuery)
  const activeThreadTurns = useSearchStore((s) => s.activeThreadTurns)
  const activeSessionId = useSearchStore((s) => s.activeSessionId)

  if (event.type === 'persona_chunk' || event.type === 'meta' || event.type === 'stream_end') {
    return null
  }

  if (event.type === 'error') {
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="text-[13px] text-red-400 font-medium bg-red-400/10 px-3 py-2 rounded-xl border border-red-400/20">
          {event.message}
        </p>
        <button
          type="button"
          onClick={() => useSearchStore.getState().startSearch(currentTurnQuery || "")}
          className="w-fit text-[11px] font-bold text-nexus-accent hover:text-nexus-accent/80 transition-colors px-3 py-1 bg-nexus-accent/5 rounded-lg border border-nexus-accent/10"
        >
          Try again
        </button>
      </div>
    )
  }

  // Find which turn this event belongs to (heuristic: latest search turn)
  const currentTurnQuery = activeThreadTurns
    .filter(t => t.session_id === activeSessionId && t.status !== 'chat').at(-1)?.user_message

  if (event.type === 'complete') {
    const leadCount = event.data?.leads?.length ?? event.data?.profile_count ?? 0
    const isActive = activeResultQuery === currentTurnQuery

    return (
      <div className="flex flex-wrap items-center gap-3 py-1">
        <button
          type="button"
          onClick={() => currentTurnQuery && setActiveResultQuery(currentTurnQuery)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
            isActive 
              ? "bg-nexus-accent text-white border-nexus-accent shadow-sm"
              : "bg-nexus-card/80 text-nexus-text border-nexus-border hover:border-nexus-accent/50 hover:bg-nexus-card"
          )}
        >
          <Table className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-nexus-accent")} />
          <span>{leadCount} profiles ready in the table</span>
        </button>
        
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
          <CheckCircle2 className="w-3 h-3" />
          Task Completed!!
        </div>
      </div>
    )
  }

  if (event.type === 'ranking') {
    return (
      <div className="flex items-center gap-2 text-sm text-nexus-muted py-1 italic">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-nexus-accent" />
        <span>{event.message}</span>
      </div>
    )
  }

  if (event.type === 'plan' && (event.data?.criteria || event.data?.queries)) {
    const queries = (event.data?.queries ?? []) as string[]
    const visibleQueries = queries.slice(0, 2)
    const hiddenCount = Math.max(0, queries.length - visibleQueries.length)
    return (
      <div className="space-y-3 py-1">
        <div className="flex items-center gap-2 text-sm font-medium text-nexus-text">
          <Search className="w-4 h-4 text-nexus-accent" />
          {event.message}
        </div>
        {visibleQueries.length > 0 && (
          <ul className="space-y-1.5 pl-1">
            {visibleQueries.map((q, i) => (
              <li key={i} className="flex items-center gap-2 text-nexus-muted">
                <div className="h-1 w-1 rounded-full bg-nexus-accent/50" />
                <span className="text-xs truncate max-w-sm" title={q}>{q}</span>
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 && (
          <p className="text-[11px] text-nexus-muted opacity-70">
            Scanning {hiddenCount} additional data points...
          </p>
        )}
      </div>
    )
  }

  return <p className="text-nexus-text text-sm py-1">{event.message}</p>
}
