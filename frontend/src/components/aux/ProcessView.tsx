import { useEffect } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'

/** Full-width "Process" view — lists every search session. */
export function ProcessView() {
  const sessions = useSearchStore((s) => s.sessions)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const loadSession = useSearchStore((s) => s.loadSession)
  const setAuxView = useUIStore((s) => s.setAuxView)

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  function openSession(id: string) {
    setAuxView('chat')
    void loadSession(id)
  }

  return (
    <section className="flex-1 flex flex-col bg-nexus-bg min-w-0">
      <header className="h-14 px-5 flex items-center border-b border-nexus-border">
        <h2 className="text-sm font-semibold">Process</h2>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-muted" />
            <input
              type="search"
              placeholder="Search…"
              disabled
              className="input-base pl-9 opacity-60"
            />
          </div>

          {sessions.length === 0 && (
            <p className="text-sm text-nexus-muted text-center py-12">
              No processes yet. Start a search from the New Chat view.
            </p>
          )}

          <ul className="divide-y divide-nexus-border border border-nexus-border rounded-lg overflow-hidden">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openSession(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-nexus-card/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.title || s.original_query}</div>
                    <div className="text-xs text-nexus-muted mt-0.5">
                      {formatDate(s.created_at)} · {s.lead_count} leads · {s.status}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-nexus-muted">
                    Continue
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {sessions.length > 0 && (
            <p className="text-xs text-nexus-muted text-center mt-4">— No More Results —</p>
          )}
        </div>
      </div>
    </section>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
