import { useEffect, useRef } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { AgentConversation } from './AgentConversation'
import { SearchInput } from './SearchInput'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import { useSearch } from '@/hooks/useSearch'

/**
 * Chat panel shown in the two-panel view after a search has started.
 * Renders the user's original query as a bubble, then a flowing sequence
 * of agent step lines, and a session chip when complete.
 */
export function ChatPanel() {
  const { query, setQuery, isSearching, submit } = useSearch()
  const events = useSearchStore((s) => s.streamEvents)
  const sessions = useSearchStore((s) => s.sessions)
  const activeId = useSearchStore((s) => s.activeSessionId)
  const lastError = useSearchStore((s) => s.lastError)
  const elapsedMs = useSearchStore((s) => s.lastSearchElapsedMs)
  const chatWidth = useUIStore((s) => s.chatWidth)
  const endRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeId) ?? null
  const userQuery = activeSession?.original_query ?? query

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [events.length, isSearching])

  const complete = events.some((e) => e.type === 'complete')
  const errored = events.some((e) => e.type === 'error') || Boolean(lastError)

  return (
    <section
      className="flex flex-col shrink-0 min-h-0 border-r border-nexus-border bg-nexus-surface"
      style={{ width: `${chatWidth}px` }}
    >
      <header className="flex items-center justify-between h-14 px-5 border-b border-nexus-border">
        <h2 className="text-sm font-semibold truncate">
          {activeSession?.title || userQuery || 'New search'}
        </h2>
        {isSearching && (
          <span className="flex items-center gap-2 text-xs text-nexus-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking…
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {userQuery && <UserBubble text={userQuery} />}

        {isSearching && events.length === 0 && <ThinkingLine />}

        <AgentConversation />

        {complete && activeSession && (
          <SessionChip
            title={activeSession.title || userQuery}
            elapsedMs={elapsedMs}
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

      <div className="border-t border-nexus-border p-3">
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
    </section>
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
    <p className="text-sm text-nexus-muted italic flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      Thinking…
    </p>
  )
}

function SessionChip({ title, elapsedMs }: { title: string | null; elapsedMs: number | null }) {
  const timing =
    elapsedMs != null && elapsedMs >= 0 ? ` · ${(elapsedMs / 1000).toFixed(1)}s total` : ''
  return (
    <div className="pt-2 space-y-2">
      <div className="flex items-center gap-2 text-xs text-nexus-accent">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Task completed{timing}
      </div>
      <div className="inline-flex items-center gap-2 rounded-lg border border-nexus-border bg-nexus-card px-3 py-2 text-sm max-w-full">
        <span className="w-2 h-2 rounded-full bg-nexus-accent" />
        <span className="truncate">{title || 'Results'}</span>
      </div>
    </div>
  )
}
