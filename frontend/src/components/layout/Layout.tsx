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
import { SystemView } from '@/components/aux/SystemView'
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
  const sseStreamEpoch = useSearchStore((s) => s.sseStreamEpoch)
  const activeThreadTurns = useSearchStore((s) => s.activeThreadTurns)
  const sessions = useSearchStore((s) => s.sessions)
  const isSearching = useSearchStore((s) => s.isSearching)
  const eventCount = useSearchStore((s) => s.streamEvents.length)
  const leadCount = useSearchStore((s) => s.leads.length)
  const auxView = useUIStore((s) => s.auxView)

  const sseSessionId =
    isSearching && activeSessionId && !activeSessionId.startsWith('local-')
      ? activeSessionId
      : null
  useSSE(sseSessionId, sseStreamEpoch)

  const currentTurn = useMemo(
    () =>
      (activeSessionId
        ? activeThreadTurns.filter((turn) => turn.session_id === activeSessionId).at(-1)
        : null) ??
      activeThreadTurns.at(-1) ??
      null,
    [activeSessionId, activeThreadTurns],
  )
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  )
  const hasThreadContext = Boolean(activeSessionId) || activeThreadTurns.length > 0
  const searchLikeTurn = currentTurn?.status && currentTurn.status !== 'chat'
  const searchLikeSession = activeSession?.status && activeSession.status !== 'chat'
  const showSearchWorkspace = useMemo(() => {
    const hasRankedData = leadCount > 0
    const hasSearchEvents = eventCount > 0
    const searchInFlight = isSearching && Boolean(searchLikeTurn || searchLikeSession || hasSearchEvents)
    return hasRankedData || hasSearchEvents || searchInFlight
  }, [eventCount, isSearching, leadCount, searchLikeSession, searchLikeTurn])


  return (
    <div className="flex h-screen bg-nexus-bg text-nexus-text overflow-hidden">
      <Sidebar />

      {auxView === 'process' && <ProcessView />}
      {auxView === 'emails' && <EmailsView />}
      {auxView === 'mylist' && <MyListView />}
      {auxView === 'system' && <SystemView />}

      {auxView === 'chat' && (
        !hasThreadContext ? (
          <HeroSearch />
        ) : showSearchWorkspace ? (
          <div className="flex flex-1 min-h-0 min-w-0">
            <ChatPanel />
            <PanelResizer />
            <ResultsTable />
            <SessionChip />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 min-w-0">
            <ChatPanel standalone />
          </div>
        )
      )}

      <OutreachModal />
    </div>
  )
}
