import { useMemo, useState } from 'react'
import { ContactRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSearchStore } from '@/stores/searchStore'

type Tab = 'all' | 'recent' | 'exported'

/** "My List" view — aggregates leads from all sessions. */
export function MyListView() {
  const [tab, setTab] = useState<Tab>('all')
  const sessions = useSearchStore((s) => s.sessions)

  const total = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.lead_count ?? 0), 0),
    [sessions],
  )

  return (
    <section className="flex-1 flex bg-nexus-bg min-w-0">
      <div className="w-[200px] border-r border-nexus-border bg-nexus-surface p-4 flex flex-col gap-1">
        <h2 className="text-xs uppercase tracking-wider text-nexus-muted px-2 mb-2">My List</h2>
        <TabLink label="All" count={total} active={tab === 'all'} onClick={() => setTab('all')} />
        <TabLink label="Recently Added" count={total} active={tab === 'recent'} onClick={() => setTab('recent')} />
        <TabLink label="Exported" count={0} active={tab === 'exported'} onClick={() => setTab('exported')} />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="h-14 px-5 flex items-center border-b border-nexus-border">
          <h2 className="text-sm font-semibold capitalize">{tab === 'recent' ? 'Recently Added' : tab}</h2>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-full border border-nexus-border flex items-center justify-center mb-4 bg-nexus-card">
            <ContactRound className="w-6 h-6 text-nexus-muted" />
          </div>
          <h3 className="text-base font-medium">{total} People</h3>
          <p className="text-sm text-nexus-muted mt-2 max-w-sm">
            {total > 0
              ? 'Leads you save from search results will be collected here.'
              : 'People you’ve saved to your list will be shown here.'}
          </p>
        </div>
      </div>
    </section>
  )
}

function TabLink({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-nexus-elevated text-nexus-text border border-nexus-border'
          : 'text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated/60 border border-transparent',
      )}
    >
      <div>{label}</div>
      <div className="text-xs text-nexus-muted">{count} People</div>
    </button>
  )
}
