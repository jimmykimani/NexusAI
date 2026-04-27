import { useEffect, useRef } from 'react'
import { AlertCircle, Loader2, Table2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AgentConversation } from './AgentConversation'
import { SearchInput } from './SearchInput'
import { SearchHuntIndicator } from './SearchHuntIndicator'
import { SessionFeedbackRow } from '@/components/results/FeedbackButtons'
import type { ConversationTurn } from '@/types'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import { useSearch } from '@/hooks/useSearch'

/**
 * Chat panel shown in the two-panel view after a search has started.
 * Keeps the conversation focused on the active session only, so follow-up
 * searches feel like one thread instead of a mixed feed of old sessions.
 */
export function ChatPanel({ standalone = false }: { standalone?: boolean }) {
  const { query, setQuery, isSearching, submit } = useSearch()
  const events = useSearchStore((s) => s.streamEvents)
  const threadTurns = useSearchStore((s) => s.activeThreadTurns)
  const sessions = useSearchStore((s) => s.sessions)
  const activeId = useSearchStore((s) => s.activeSessionId)
  const pendingQuery = useSearchStore((s) => s.pendingQuery)
  const lastError = useSearchStore((s) => s.lastError)
  const elapsedMs = useSearchStore((s) => s.lastSearchElapsedMs)
  const chatWidth = useUIStore((s) => s.chatWidth)
  const endRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeId) ?? null
  const turnsForActive = threadTurns.filter((t) => t.session_id === activeId)
  const currentTurn = turnsForActive.at(-1) ?? null
  const previousTurns = turnsForActive.slice(0, -1)
  const userQuery = pendingQuery ?? currentTurn?.user_message ?? activeSession?.original_query ?? query

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [events.length, isSearching])

  const errored = events.some((e) => e.type === 'error') || Boolean(lastError)

  return (
    <section
      className={`flex min-h-0 flex-col ${standalone ? 'flex-1 bg-nexus-surface' : 'shrink-0 border-r border-nexus-border bg-nexus-surface'}`}
      style={standalone ? undefined : { width: `${chatWidth}px` }}
    >
      <header className="h-14 border-b border-nexus-border px-5">
        <div className="flex h-full min-w-0 items-center justify-between gap-3">
          <h2 className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm font-semibold">
            {activeSession?.title || userQuery || 'New search'}
          </h2>
          {isSearching && (
            <span className="flex shrink-0 items-center gap-2 text-xs text-nexus-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className={`mx-auto w-full space-y-4 ${standalone ? 'max-w-[840px]' : ''}`}>
          {previousTurns.map((turn) => (
            <ThreadTurnCard key={turn.id} turn={turn} session={activeSession} />
          ))}

          {userQuery && <UserBubble text={userQuery} />}

          {isSearching && events.length === 0 && <ThinkingLine />}
          {isSearching && events.length > 0 && <SearchHuntIndicator />}

          <AgentConversation events={events} elapsedMs={elapsedMs} />

          {/* Show Turn Results/Status Pill even while searching */}
          {(currentTurn || (isSearching && pendingQuery)) && (
            <div className="pt-2 animate-slide-in">
              <SearchTurnMeta
                sessionId={activeId ?? 'local'}
                query={pendingQuery ?? currentTurn?.user_message ?? ''}
                status={isSearching ? 'searching' : (activeSession?.status ?? currentTurn?.status ?? 'complete')}
                resultCount={activeSession?.lead_count ?? currentTurn?.result_lead_count ?? 0}
                isCurrentRun={true}
                isSearching={isSearching}
                elapsedMs={elapsedMs}
              />
            </div>
          )}

          {!isSearching && events.length === 0 && currentTurn?.assistant_summary && (
            <div className="pt-2">
              <AssistantSummary text={currentTurn.assistant_summary} />
              <div className="flex items-center gap-4 pt-4 animate-slide-in-late">
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-nexus-accent animate-pulse" />
                  <span className="text-[11px] font-semibold text-nexus-accent uppercase tracking-wider">Task Completed!!</span>
                </div>
                <div className="h-4 w-px bg-nexus-border/50" />
                <SessionFeedbackRow sessionId={activeId ?? ''} />
              </div>
            </div>
          )}

          {errored && !isSearching && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Agent reported an error. Check logs for details.
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-nexus-border p-3">
        <div className={`mx-auto w-full ${standalone ? 'max-w-[840px]' : ''}`}>
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={(val) => submit(val)}
            disabled={isSearching}
            placeholder="Reply to NexusAI…"
            compact
            glowing={isSearching}
          />
        </div>
      </div>
    </section>
  )
}

function ThreadTurnCard({
  turn,
  session,
}: {
  turn: ConversationTurn
  session: { id: string; title: string | null; original_query: string; status: string } | null
}) {
  return (
    <div className="space-y-6">
      <UserBubble text={turn.user_message} />
      <div className="flex flex-col gap-3">
        {turn.events && turn.events.length > 0 && (
          <div className="pl-1">
            <AgentConversation events={turn.events} />
          </div>
        )}
        {turn.assistant_summary ? (
          <div className="space-y-4">
            <AssistantSummary text={turn.assistant_summary} />
            {turn.status !== 'chat' && (
              <div className="pl-1 space-y-4">
                <SearchTurnMeta
                  sessionId={turn.session_id}
                  query={turn.user_message}
                  status={turn.status ?? session?.status}
                  resultCount={turn.result_lead_count}
                  isCurrentRun={false}
                  isSearching={false}
                  elapsedMs={null}
                />
                <div className="flex items-center gap-4 pt-1 animate-slide-in-late">
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-nexus-accent/50" />
                    <span className="text-[11px] font-semibold text-nexus-muted uppercase tracking-wider">Archived Result</span>
                  </div>
                  <div className="h-4 w-px bg-nexus-border/50" />
                  <SessionFeedbackRow sessionId={turn.session_id} />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-end gap-1 animate-slide-in">
      <div className="text-[10px] uppercase tracking-wider text-nexus-muted px-1">User</div>
      <div className="max-w-[70%] rounded-2xl border border-nexus-border bg-nexus-elevated/40 px-3.5 py-2 text-[13px] leading-relaxed text-nexus-text shadow-sm">
        {text}
      </div>
    </div>
  )
}

function ThinkingLine() {
  return (
    <p className="flex items-center gap-2 text-sm italic text-nexus-muted animate-slide-in">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Thinking…
    </p>
  )
}

function AssistantSummary({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5 animate-slide-in max-w-[90%]">
      <div className="flex items-center gap-2 px-1">
        <div className="w-4 h-4 rounded-full bg-nexus-accent/20 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-nexus-accent" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-nexus-muted">NexusAI</div>
      </div>
      <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-nexus-text pl-1">
        {text}
      </div>
    </div>
  )
}

function SearchTurnMeta({
  sessionId,
  query,
  status,
  resultCount,
  isCurrentRun,
  isSearching,
  elapsedMs,
}: {
  sessionId: string
  query: string | null
  status: string | null
  resultCount: number
  isCurrentRun: boolean
  isSearching: boolean
  elapsedMs: number | null
}) {
  const showCompleted = status === 'complete' && (!isCurrentRun || !isSearching)
  const showEmpty = showCompleted && resultCount === 0
  const timing =
    showCompleted && elapsedMs != null && elapsedMs >= 0 ? ` · ${(elapsedMs / 1000).toFixed(1)}s total` : ''
  const countLabel =
    resultCount > 0
      ? `${resultCount} profile${resultCount === 1 ? '' : 's'} ready in the table`
      : 'No matches were found in this pass'

  if (isCurrentRun && isSearching) return null

  const setActiveResultQuery = useSearchStore((s) => s.setActiveResultQuery)
  const activeResultQuery = useSearchStore((s) => s.activeResultQuery)
  const isSelected = activeResultQuery === query && query !== null

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <button
        type="button"
        onClick={() => {
          if (query && showCompleted) {
            setActiveResultQuery(query)
          }
        }}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition shadow-sm',
          showCompleted
            ? showEmpty
              ? 'border-amber-400/25 bg-amber-400/8 text-amber-200'
              : isSelected
                ? 'border-nexus-accent bg-nexus-accent/15 text-nexus-accent shadow-[0_0_12px_rgba(34,197,94,0.15)] ring-1 ring-nexus-accent/30'
                : 'border-nexus-border bg-nexus-card/50 text-nexus-text/90 cursor-pointer hover:border-nexus-accent/50 hover:bg-nexus-accent/5'
            : status === 'error'
              ? 'border-red-400/25 bg-red-500/8 text-red-300'
              : 'border-nexus-border bg-nexus-surface/50 text-nexus-muted'
        )}
      >
        {showCompleted ? (
          <Table2 className="h-3.5 w-3.5 text-nexus-accent" />
        ) : status === 'error' ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        <span className="truncate max-w-[240px]">
          {showCompleted
            ? `${countLabel}${timing}`
            : status === 'error'
              ? 'Error resolving results'
              : 'Refining discovery pipeline…'}
        </span>
      </button>

      {showCompleted && (
        <div className="flex items-center gap-4 animate-slide-in">
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-nexus-accent animate-pulse" />
            <span className="text-[11px] font-semibold text-nexus-accent uppercase tracking-wider">Task Completed!!</span>
          </div>
          <div className="h-4 w-px bg-nexus-border/50" />
          <SessionFeedbackRow sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}
