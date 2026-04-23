import { X } from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'

/** Floating bottom-right chip showing the current session title + dismiss. */
export function SessionChip() {
  const activeId = useSearchStore((s) => s.activeSessionId)
  const sessions = useSearchStore((s) => s.sessions)
  const resetCurrent = useSearchStore((s) => s.resetCurrent)

  if (!activeId) return null
  const session = sessions.find((s) => s.id === activeId)
  if (!session) return null

  return (
    <div className="absolute bottom-4 right-4 z-30">
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-nexus-border bg-nexus-card shadow-sm">
        <span className="w-2 h-2 rounded-full bg-nexus-accent" />
        <span className="text-sm text-nexus-text truncate max-w-[240px]">
          {session.title || session.original_query}
        </span>
        <button
          type="button"
          onClick={resetCurrent}
          className="text-nexus-muted hover:text-nexus-text"
          title="Close session"
          aria-label="Close session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
