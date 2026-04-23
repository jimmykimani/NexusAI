import { useMemo } from 'react'
import { Sidebar } from './Sidebar'
import { PanelResizer } from './PanelResizer'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ResultsTable } from '@/components/results/ResultsTable'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { HeroSearch } from '@/components/home/HeroSearch'
import { ProcessView } from '@/components/aux/ProcessView'
import { EmailsView } from '@/components/aux/EmailsView'
import { MyListView } from '@/components/aux/MyListView'
import { SessionChip } from '@/components/results/SessionChip'
import { useSSE } from '@/hooks/useSSE'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Top-level shell:
 * - Sidebar always on the left.
 * - If an aux view is selected (Process/Emails/MyList), render it full-width.
 * - Otherwise render Hero (no active session) or the two-panel Chat+Results.
 */
export function Layout() {
  const activeSessionId = useSearchStore((s) => s.activeSessionId)
  const isSearching = useSearchStore((s) => s.isSearching)
  const eventCount = useSearchStore((s) => s.streamEvents.length)
  const leadCount = useSearchStore((s) => s.leads.length)
  const auxView = useUIStore((s) => s.auxView)

  useSSE(isSearching ? activeSessionId : null)

  const inSearch = useMemo(
    () => Boolean(activeSessionId) || isSearching || eventCount > 0 || leadCount > 0,
    [activeSessionId, isSearching, eventCount, leadCount],
  )

  return (
    <div className="flex h-screen bg-nexus-bg text-nexus-text overflow-hidden">
      <Sidebar />

      {auxView === 'process' && <ProcessView />}
      {auxView === 'emails' && <EmailsView />}
      {auxView === 'mylist' && <MyListView />}

      {auxView === 'chat' && (
        inSearch ? (
          <div className="flex flex-1 min-h-0 min-w-0">
            <ChatPanel />
            <PanelResizer />
            <ResultsTable />
            <SessionChip />
          </div>
        ) : (
          <HeroSearch />
        )
      )}

      <OutreachModal />
    </div>
  )
}
