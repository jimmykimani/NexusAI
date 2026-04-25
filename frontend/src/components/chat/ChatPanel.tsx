import { useEffect, useMemo, useRef } from 'react'
import { CheckCircle2, Loader2, Table2 } from 'lucide-react'
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
 * Renders the user's original query as a bubble, then a flowing sequence
 * of agent step lines, and a session chip when complete.
 */
export function ChatPanel({ standalone = false }: { standalone?: boolean }) {
  const { query, setQuery, isSearching, submit } = useSearch()
  const events = useSearchStore((s) => s.streamEvents)
  const threadTurns = useSearchStore((s) => s.activeThreadTurns)
  const sessions = useSearchStore((s) => s.sessions)
  const activeId = useSearchStore((s) => s.activeSessionId)
  const lastError = useSearchStore((s) => s.lastError)
  const elapsedMs = useSearchStore((s) => s.lastSearchElapsedMs)
  const loadSession = useSearchStore((s) => s.loadSession)
  const chatWidth = useUIStore((s) => s.chatWidth)
  const endRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeId) ?? null
  const currentTurn = threadTurns.find((turn) => turn.session_id === activeId) ?? null
  const userQuery = currentTurn?.user_message ?? activeSession?.original_query ?? query
  const previousTurns = threadTurns.filter((turn) => turn.session_id !== activeId)
  const sessionsById = useMemo(() => {
    const index = new Map<string, (typeof sessions)[number]>()
    for (const s of sessions) index.set(s.id, s)
    return index
  }, [sessions])

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

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className={`mx-auto w-full ${standalone ? 'max-w-[840px]' : ''} space-y-4`}>
          {previousTurns.map((turn) => (
            <ThreadTurnCard
              key={turn.id}
              turn={turn}
              session={sessionsById.get(turn.session_id) ?? null}
              isSelected={turn.session_id === activeId}
              isCurrent={false}
              isSearching={isSearching}
              elapsedMs={null}
              onOpen={(sessionId) => {
                // Avoid interrupting the active SSE run by switching sessions mid-search.
                if (isSearching) return
                void loadSession(sessionId)
              }}
            />
          ))}

          {userQuery && <UserBubble text={userQuery} />}

          {isSearching && events.length === 0 && <ThinkingLine />}
          {isSearching && events.length > 0 && <SearchHuntIndicator />}

          <AgentConversation />

          {!isSearching && events.length === 0 && currentTurn?.assistant_summary && (
            <AssistantSummary text={currentTurn.assistant_summary} />
          )}

          {currentTurn?.status !== 'chat' && currentTurn && (
            <SearchResultCard
              title={activeSession?.title || activeSession?.original_query || currentTurn.user_message}
              sessionId={currentTurn.session_id}
              status={activeSession?.status ?? currentTurn.status}
              isSelected
              isCurrentRun
              isSearching={isSearching}
              elapsedMs={elapsedMs}
              onOpen={() => {
                if (isSearching) return
                void loadSession(currentTurn.session_id)
              }}
            />
          )}

          {errored && !isSearching && (
            <div className="text-xs text-red-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
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
            onSubmit={() => submit()}
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
  isSelected,
  isCurrent,
  isSearching,
  elapsedMs,
  onOpen,
}: {
  turn: ConversationTurn
  session: { id: string; title: string | null; original_query: string; status: string } | null
  isSelected: boolean
  isCurrent: boolean
  isSearching: boolean
  elapsedMs: number | null
  onOpen: (sessionId: string) => void
}) {
  return (
    <div className="space-y-3">
      <UserBubble text={turn.user_message} />
      {turn.assistant_summary ? <AssistantSummary text={turn.assistant_summary} /> : null}
      {turn.status !== 'chat' && (
        <SearchResultCard
          title={session?.title || session?.original_query || turn.user_message}
          sessionId={turn.session_id}
          status={session?.status ?? turn.status}
          isSelected={isSelected}
          isCurrentRun={isCurrent}
          isSearching={isSearching}
          elapsedMs={elapsedMs}
          onOpen={() => onOpen(turn.session_id)}
        />
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-nexus-card border border-nexus-border px-3.5 py-2 text-sm leading-relaxed">
        {text}
      </div>
    </div>
  )
}

function ThinkingLine() {
  return (
    <p className="flex items-center gap-2 text-sm italic text-nexus-muted">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Thinking…
    </p>
  )
}

function AssistantSummary({ text }: { text: string }) {
  return (
    <div className="max-w-[95%] rounded-2xl border border-nexus-border/80 bg-nexus-card/60 px-4 py-3 text-[13px] leading-relaxed text-nexus-text whitespace-pre-wrap">
      {text}
    </div>
  )
}

function SearchResultCard({
  title,
  elapsedMs,
  sessionId,
  status,
  isSelected,
  isCurrentRun,
  isSearching,
  onOpen,
}: {
  title: string | null
  elapsedMs: number | null
  sessionId: string
  status: string | null
  isSelected: boolean
  isCurrentRun: boolean
  isSearching: boolean
  onOpen: () => void
}) {
  const showCompleted = status === 'complete' && (!isCurrentRun || !isSearching)
  const showInProgress = !showCompleted
  const timing =
    showCompleted && elapsedMs != null && elapsedMs >= 0 ? ` · ${(elapsedMs / 1000).toFixed(1)}s total` : ''
  return (
    <div className="pt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-xs ${showCompleted ? 'text-nexus-accent' : 'text-nexus-muted'}`}>
          {showCompleted ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {showCompleted ? `Task completed${timing}` : 'Search in motion'}
        </div>
        {showCompleted && (
          <div className="shrink-0">
            <SessionFeedbackRow sessionId={sessionId} />
          </div>
        )}
      </div>
      <div
        className={`flex min-w-0 max-w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
          isSelected
            ? 'border-nexus-accent/40 bg-nexus-accent/5'
            : 'border-nexus-border bg-nexus-card/70'
        }`}
      >
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left hover:text-nexus-accent transition-colors"
          title="Open results table"
        >
          <span
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
              showCompleted
                ? 'border-nexus-accent/30 bg-nexus-accent/10 text-nexus-accent'
                : 'border-nexus-border bg-nexus-elevated/60 text-nexus-muted'
            }`}
          >
            <Table2 className="h-3 w-3" />
          </span>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-nexus-muted">
            Results
          </span>
          <span className="min-w-0 truncate whitespace-nowrap">{title || 'Results'}</span>
        </button>
        {showInProgress && <span className="text-[11px] text-nexus-muted">Running…</span>}
      </div>
    </div>
  )
}
