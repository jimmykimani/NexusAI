import { useEffect, useMemo, useState } from 'react'
import { Clock3, ContactRound, Mail, MapPin, Search, Sparkles, Star } from 'lucide-react'
import { api, apiErrorMessage } from '@/api/client'
import type { Lead, SearchSession } from '@/types'
import { useSearchStore } from '@/stores/searchStore'

type Tab = 'all' | 'recent' | 'contacted'

export function MyListView() {
  const [tab, setTab] = useState<Tab>('all')
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sessions = useSearchStore((s) => s.sessions)

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get<Lead[]>('/leads/library')
        setLeads(response.data)
        setError(null)
      } catch (err) {
        setError(apiErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const sessionMap = useMemo(
    () => new Map<string, SearchSession>(sessions.map((session) => [session.id, session])),
    [sessions],
  )
  const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 7
  const recentCount = leads.filter((lead) => new Date(lead.created_at).getTime() >= recentCutoff).length
  const contactedCount = leads.filter((lead) => lead.outreach_sent).length

  const filtered = useMemo(() => {
    if (tab === 'recent') {
      return leads.filter((lead) => new Date(lead.created_at).getTime() >= recentCutoff)
    }
    if (tab === 'contacted') {
      return leads.filter((lead) => lead.outreach_sent)
    }
    return leads
  }, [leads, recentCutoff, tab])

  return (
    <section className="flex min-w-0 flex-1 bg-nexus-bg">
      <aside className="w-[232px] shrink-0 border-r border-nexus-border bg-nexus-surface px-4 py-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-nexus-muted">My List</div>
          <div className="mt-2 text-base font-semibold text-nexus-text">Saved people</div>
        </div>

        <nav className="space-y-1.5">
          <TabLink label="All" meta={`${leads.length} people`} active={tab === 'all'} onClick={() => setTab('all')} />
          <TabLink label="Recently Added" meta={`${recentCount} people`} active={tab === 'recent'} onClick={() => setTab('recent')} />
          <TabLink label="Contacted" meta={`${contactedCount} people`} active={tab === 'contacted'} onClick={() => setTab('contacted')} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-nexus-border px-6 py-4">
          <div className="text-base font-semibold text-nexus-text">
            {tab === 'all' ? 'All people' : tab === 'recent' ? 'Recently added' : 'Contacted leads'}
          </div>
          <div className="mt-1 text-sm text-nexus-muted">{filtered.length} people</div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="text-sm text-nexus-muted">Loading your saved people…</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(360px,1fr))]">
              {filtered.map((lead) => {
                const session = sessionMap.get(lead.session_id)
                return (
                  <article
                    key={lead.id}
                    className="rounded-[22px] border border-nexus-border bg-nexus-surface p-5 shadow-[0_14px_32px_-30px_rgba(15,23,42,0.28)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-nexus-card text-nexus-accent">
                        {lead.outreach_sent ? <Sparkles className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-nexus-text">
                          {lead.name || 'Unknown lead'}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm leading-6 text-nexus-muted">
                          {lead.headline || lead.title || lead.company || 'No headline yet'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {lead.location && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-nexus-border bg-nexus-card px-2.5 py-1 text-nexus-subtle">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{lead.location}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full border border-nexus-border bg-nexus-card px-2.5 py-1 text-nexus-subtle">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(lead.created_at)}
                      </span>
                      {lead.outreach_sent && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          <Mail className="h-3.5 w-3.5" />
                          Contacted
                        </span>
                      )}
                    </div>

                    <div className="mt-3 rounded-[18px] border border-nexus-border bg-nexus-card/55 px-3 py-3.5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-nexus-muted">Source Search</div>
                      <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-nexus-text">
                        <Search className="mt-0.5 h-4 w-4 shrink-0 text-nexus-muted" />
                        <span className="line-clamp-2">
                          {session?.title || session?.original_query || 'Search session'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 line-clamp-5 text-sm leading-7 text-nexus-subtle">
                      {lead.ai_summary || lead.bio || 'No summary captured for this lead yet.'}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function TabLink({
  label,
  meta,
  active,
  onClick,
}: {
  label: string
  meta: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border px-3 py-3 text-left transition-colors ${
        active
          ? 'border-nexus-border bg-nexus-card text-nexus-text'
          : 'border-transparent text-nexus-muted hover:border-nexus-border hover:bg-nexus-card/60 hover:text-nexus-text'
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-nexus-muted">{meta}</div>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-nexus-border bg-nexus-surface/70 px-6 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-nexus-border bg-nexus-card">
        <ContactRound className="h-6 w-6 text-nexus-muted" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No people here yet</h3>
      <p className="mt-2 max-w-md text-sm text-nexus-muted">
        Run a search and the workspace will collect matching people here across your conversations.
      </p>
    </div>
  )
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
