import { useMemo } from 'react'
import {
  ChevronDown,
  Download,
  Layers,
  Loader2,
  Mail,
  Plus,
  Users,
  Search,
} from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import { dynamicColMaxClass } from './dynamicColLayout'
import { LeadRow } from './LeadRow'
import type { Lead } from '@/types'

/** Right panel: toolbar, grouped leads table, empty/loading states. */
export function ResultsTable() {
  const leadsRaw = useSearchStore((s) => s.leads)
  const activeResultQuery = useSearchStore((s) => s.activeResultQuery)
  const isSearching = useSearchStore((s) => s.isSearching)
  const sessions = useSearchStore((s) => s.sessions)
  const activeSessionId = useSearchStore((s) => s.activeSessionId)
  const selectedIds = useSearchStore((s) => s.selectedLeadIds)
  const activeThreadTurns = useSearchStore((s) => s.activeThreadTurns)
  const streamEvents = useSearchStore((s) => s.streamEvents)
  const clearSelection = useSearchStore((s) => s.clearSelection)
  const openOutreach = useUIStore((s) => s.openOutreach)
  const showToast = useUIStore((s) => s.showToast)
  const setActiveResultQuery = useSearchStore((s) => s.setActiveResultQuery)

  const selectedCount = selectedIds.size
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const currentTurn = activeThreadTurns.filter((turn) => turn.session_id === activeSessionId).at(-1) ?? null
  
  // Filter leads by the active pill (or fallback to latest search turn if not chat)
  const activeFilterQuery = activeResultQuery || (currentTurn?.status !== 'chat' ? currentTurn?.user_message : null)
  
  const leads = useMemo(() => {
    const active = (activeFilterQuery || '').trim().toLowerCase()
    const filtered = leadsRaw.filter((l) => {
      if (!active) return true
      const sq = (l.source_query || '').trim().toLowerCase()
      return sq === active
    })
    
    // Fallback: If filtered is empty but we have an active filter, 
    // maybe try matching against the session's original query just in case 
    // there was a slight mismatch in history capture.
    if (filtered.length === 0 && active && activeSession?.original_query) {
      const orig = activeSession.original_query.trim().toLowerCase()
      if (orig === active) {
         return leadsRaw.filter(l => (l.source_query || '').trim().toLowerCase() === orig)
      }
    }
    
    return filtered
  }, [leadsRaw, activeFilterQuery, activeSession?.original_query])
  const fully = useMemo(() => leads.filter(l => l.match_status === 'fully_matched'), [leads])
  const partial = useMemo(() => leads.filter(l => l.match_status !== 'fully_matched'), [leads])
  
  const csv = useMemo(() => toCSV(leads), [leads])
  
  const tableTitle = activeFilterQuery || currentTurn?.user_message || activeSession?.title || activeSession?.original_query || 'Results table'
  const hasTerminalEvent = streamEvents.some((event) => event.type === 'complete' || event.type === 'error')
  const searchInFlight = isSearching || (streamEvents.length > 0 && !hasTerminalEvent)
  const emptyVariant =
    activeSession?.status === 'error'
      ? 'error'
      : activeSession?.status === 'complete' || currentTurn?.status === 'complete'
        ? 'no-results'
        : 'idle'

  function exportCsv() {
    if (!leads.length) {
      showToast('info', 'Nothing to export yet.')
      return
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexusai-leads-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function compose() {
    if (selectedCount === 0) {
      showToast('info', 'Select at least one lead first.')
      return
    }
    openOutreach()
  }

  return (
    <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-nexus-bg relative">
      <div className="flex shrink-0 items-center gap-1 px-4 h-14 border-b border-nexus-border bg-nexus-bg z-20">
        <button type="button" onClick={compose} className="btn-ghost">
          <Mail className="w-4 h-4" />
          Compose Email{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        <button type="button" onClick={exportCsv} className="btn-ghost">
          <Download className="w-4 h-4" />
          Export
        </button>
        <button type="button" className="btn-ghost" disabled title="Grouping coming soon">
          <Layers className="w-4 h-4" />
          Group
        </button>
        <div className="flex-1" />
        {selectedCount > 0 && (
          <button type="button" onClick={clearSelection} className="btn-ghost">
            Clear ({selectedCount})
          </button>
        )}
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-nexus-border px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-nexus-text">{tableTitle}</div>
        </div>
        <div className="shrink-0 text-xs text-nexus-muted">
          {searchInFlight
            ? 'Searching…'
            : `${leads.length} result${leads.length === 1 ? '' : 's'}`}
        </div>
      </div>

      <div className="leads-table-scroll relative flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto">
        {searchInFlight && leads.length > 0 && <SearchingOverlay />}
        
        {leads.length === 0 && searchInFlight ? (
          <SkeletonTable />
        ) : leads.length === 0 ? (
          <div className="min-h-full">
            <EmptyState variant={emptyVariant} />
          </div>
        ) : (
          <LeadsTable fully={fully} partial={partial} />
        )}
      </div>

      {activeThreadTurns.some(t => t.status === 'complete') && (
        <div className="flex shrink-0 items-center gap-2 border-t border-nexus-border bg-nexus-surface/50 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          {activeThreadTurns.filter(t => t.status === 'complete').map((turn) => {
            const isActive = activeFilterQuery === turn.user_message
            return (
              <button
                type="button"
                key={turn.id}
                onClick={() => setActiveResultQuery(turn.user_message)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  isActive 
                    ? 'bg-nexus-card border-nexus-accent text-nexus-text shadow-sm ring-1 ring-nexus-accent/20' 
                    : 'bg-nexus-bg border-nexus-border/60 text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated/40'
                }`}
              >
                <Search className={`w-3.5 h-3.5 ${isActive ? 'text-nexus-accent' : 'opacity-60'}`} />
                {turn.user_message}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function LeadsTable({ fully, partial }: { fully: Lead[]; partial: Lead[] }) {
  const dynamicCols = useMemo(() => inferColumns([...fully, ...partial]), [fully, partial])
  const colSpan = 7 + dynamicCols.length

  return (
    <table className="leads-data-table w-max min-w-full border-collapse text-sm">
      <thead className="bg-nexus-bg">
        <tr className="border-b border-nexus-border text-xs text-nexus-muted uppercase tracking-wider">
          <Th className="w-10"></Th>
          <Th className="w-10 text-nexus-muted/70">#</Th>
          <Th className="max-w-[14rem]">Name</Th>
          <Th className="w-16 whitespace-nowrap">Link</Th>
          <Th className="whitespace-nowrap">Match</Th>
          {dynamicCols.map((c) => (
            <Th key={c.key} className={`whitespace-nowrap overflow-hidden ${dynamicColMaxClass(c.key)}`}>
              <span className="block truncate" title={c.label}>
                {c.label}
              </span>
            </Th>
          ))}
          <Th className="max-w-[11rem] whitespace-nowrap">Email</Th>
          <Th className="w-28 whitespace-nowrap">Actions</Th>
        </tr>
      </thead>
      <tbody>
        {fully.length > 0 && (
          <GroupHeader label="Fully Matched" count={fully.length} tint="accent" colSpan={colSpan} />
        )}
        {fully.map((l, i) => (
          <LeadRow key={l.id} lead={l} rank={i + 1} dynamicCols={dynamicCols} />
        ))}
        <GroupHeader label="Partially Matched" count={partial.length} tint="muted" colSpan={colSpan} />
        {partial.length === 0 ? (
          <tr className="border-b border-nexus-border/50">
            <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-nexus-muted">
              {fully.length > 0
                ? 'No partial matches — everyone in this list cleared the stronger-fit bar.'
                : 'No partial matches in this run.'}
            </td>
          </tr>
        ) : (
          partial.map((l, i) => (
            <LeadRow key={l.id} lead={l} rank={fully.length + i + 1} dynamicCols={dynamicCols} />
          ))
        )}
        <tr>
          <td colSpan={colSpan}>
            <button
              type="button"
              disabled
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated/60 transition-colors disabled:opacity-60"
              title="Re-running the search for more results isn't wired up yet"
            >
              <Plus className="w-4 h-4" />
              Find More
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left ${className}`}>{children}</th>
}

function GroupHeader({
  label,
  count,
  tint,
  colSpan,
}: {
  label: string
  count: number
  tint: 'accent' | 'muted'
  colSpan: number
}) {
  const dot = tint === 'accent' ? 'bg-nexus-accent' : 'bg-nexus-muted'
  return (
    <tr className="bg-nexus-surface/50">
      <td colSpan={colSpan} className="px-4 py-2 text-xs uppercase tracking-wider text-nexus-muted">
        <span className="inline-flex items-center gap-2">
          <ChevronDown className="w-3 h-3" />
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {label}
          <span className="normal-case text-nexus-muted/70">{count} records</span>
        </span>
      </td>
    </tr>
  )
}

function EmptyState({ variant = 'idle' }: { variant?: 'idle' | 'no-results' | 'error' }) {
  const title =
    variant === 'error'
      ? 'Search interrupted'
      : variant === 'no-results'
        ? 'No matches found'
        : 'No results yet'
  const body =
    variant === 'error'
      ? 'This run did not finish cleanly. Reply in the chat to rerun or broaden the search.'
      : variant === 'no-results'
        ? 'Nothing matched this pass. Try widening the location, relaxing a filter, or asking for adjacent roles.'
        : 'Results will appear here once the agent finishes ranking.'
  return (
    <div className="h-full flex flex-col items-center justify-center p-10 text-center">
      <div className="w-14 h-14 rounded-full border border-nexus-border flex items-center justify-center mb-4 bg-nexus-card">
        <Users className="w-6 h-6 text-nexus-muted" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="text-sm text-nexus-muted mt-2 max-w-sm">
        {body}
      </p>
    </div>
  )
}

/** Shimmer placeholder rows rendered while the agent pipeline is still running. */
function SkeletonTable() {
  const columns = ['Name', 'Link', 'Match', 'Role', 'Company', 'Location', 'Email', 'Actions']
  return (
    <table className="leads-data-table w-max min-w-full border-collapse text-sm">
      <thead className="bg-nexus-bg">
        <tr className="border-b border-nexus-border text-xs text-nexus-muted uppercase tracking-wider">
          <Th className="w-10"></Th>
          <Th className="w-10 text-nexus-muted/70">#</Th>
          {columns.map((c) => (
            <Th key={c}>{c}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="bg-nexus-surface/50">
          <td colSpan={columns.length + 2} className="px-4 py-2 text-xs uppercase tracking-wider text-nexus-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="w-1.5 h-1.5 rounded-full bg-nexus-accent animate-pulse-dot" />
              Searching &amp; ranking — results will fill in shortly
            </span>
          </td>
        </tr>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} columns={columns.length} rank={i + 1} />
        ))}
      </tbody>
    </table>
  )
}

function SearchingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-14">
      <div className="rounded-2xl border border-nexus-border/80 bg-nexus-surface/92 p-3 shadow-sm backdrop-blur-sm">
        <div className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-nexus-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing results
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[40px_1.4fr_0.8fr_0.8fr_1fr_1fr_1fr] gap-3 rounded-xl border border-nexus-border/60 bg-nexus-bg/85 px-3 py-3"
            >
              <SkeletonBar width="65%" />
              <SkeletonBar width={`${72 - index * 8}%`} />
              <SkeletonBar width="55%" />
              <SkeletonBar width="68%" />
              <SkeletonBar width="62%" />
              <SkeletonBar width="58%" />
              <SkeletonBar width="44%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkeletonRow({ columns, rank }: { columns: number; rank: number }) {
  return (
    <tr className="border-b border-nexus-border/70">
      <td className="px-3 py-3 w-10">
        <div className="w-3.5 h-3.5 rounded-sm bg-nexus-elevated/70" />
      </td>
      <td className="px-3 py-3 w-10 text-nexus-muted/60 text-xs">{rank}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-nexus-elevated/70 overflow-hidden relative">
            <div className="absolute inset-0 animate-skeleton-sweep bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
          <div className="space-y-1.5 min-w-0 flex-1 max-w-[180px]">
            <SkeletonBar width="70%" />
            <SkeletonBar width="45%" height="sm" />
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1.5">
          <div className="w-6 h-6 rounded-md bg-nexus-elevated/70" />
          <div className="w-6 h-6 rounded-md bg-nexus-elevated/70" />
        </div>
      </td>
      {Array.from({ length: columns - 2 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <SkeletonBar width={`${50 + ((i * 17) % 40)}%`} />
        </td>
      ))}
    </tr>
  )
}

function SkeletonBar({ width, height = 'md' }: { width: string; height?: 'sm' | 'md' }) {
  const h = height === 'sm' ? 'h-2' : 'h-2.5'
  return (
    <div className={`relative overflow-hidden rounded bg-nexus-elevated/70 ${h}`} style={{ width }}>
      <div className="absolute inset-0 animate-skeleton-sweep bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  )
}

export interface DynamicCol {
  key: string
  label: string
  get: (lead: Lead) => string | null
}

/**
 * Pick 3–4 criterion-like columns to show between Match and Email based on
 * the leads we have. Falls back to Title/Location/Company if nothing specific
 * is in `matched_criteria`.
 */
function inferColumns(leads: Lead[]): DynamicCol[] {
  const criterionKeys = new Map<string, number>()
  for (const l of leads) {
    const mc = l.matched_criteria
    if (!mc) continue
    for (const k of Object.keys(mc)) {
      criterionKeys.set(k, (criterionKeys.get(k) ?? 0) + 1)
    }
  }

  const topKeys = [...criterionKeys.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k)

  const cols: DynamicCol[] = [
    { key: 'title', label: 'Role', get: (l) => l.title },
    { key: 'company', label: 'Company', get: (l) => l.company },
    { key: 'location', label: 'Location', get: (l) => l.location },
  ]

  for (const k of topKeys) {
    if (cols.find((c) => c.key === k)) continue
    cols.push({
      key: k,
      label: prettifyKey(k),
      get: (l) => {
        const v = l.matched_criteria?.[k]
        return typeof v === 'boolean' ? (v ? 'Yes' : '—') : v ? String(v) : null
      },
    })
  }

  return cols
}

function prettifyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function toCSV(leads: Lead[]): string {
  const header = [
    'name', 'title', 'company', 'location', 'email',
    'linkedin_url', 'github_url', 'match_score', 'match_status',
  ]
  const lines = [header.join(',')]
  for (const l of leads) {
    const row = header.map((h) => {
      const v = (l as unknown as Record<string, unknown>)[h] ?? ''
      const s = String(v).replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}
