import { useEffect } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Inbox,
  MessageSquarePlus,
  Search,
  Settings,
  Sparkles,
  Star,
  Workflow,
} from 'lucide-react'
import { UserButton } from '@clerk/clerk-react'
import { useSearchStore } from '@/stores/searchStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import type { AuxView } from '@/stores/uiStore'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true'

/** Left sidebar: nav + recent sessions + user/footer. Expanded ~280px / collapsed 96px (w-24). */
export function Sidebar() {
  const sessions = useSearchStore((s) => s.sessions)
  const activeSessionId = useSearchStore((s) => s.activeSessionId)
  const loadSession = useSearchStore((s) => s.loadSession)
  const resetCurrent = useSearchStore((s) => s.resetCurrent)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const userEmail = useAuthStore((s) => s.user?.email)
  const auxView = useUIStore((s) => s.auxView)
  const setAuxView = useUIStore((s) => s.setAuxView)
  const showToast = useUIStore((s) => s.showToast)
  const openSettings = useUIStore((s) => s.openSettings)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  function startNew() {
    resetCurrent()
    setAuxView('chat')
  }

  function openSession(id: string) {
    setAuxView('chat')
    void loadSession(id)
  }

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 bg-nexus-surface border-r border-nexus-border transition-[width]',
        sidebarCollapsed ? 'w-24' : 'w-[280px]',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-nexus-border px-3 sm:px-4">
        <Sparkles className="h-5 w-5 shrink-0 text-nexus-accent" />
        {!sidebarCollapsed && <span className="min-w-0 truncate font-semibold tracking-tight">NexusAI</span>}
        <button
          type="button"
          onClick={toggleSidebar}
          className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-nexus-muted transition-colors hover:border-nexus-border hover:bg-nexus-card hover:text-nexus-text"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-1 px-2 pt-3">
        <NavItem
          icon={MessageSquarePlus}
          label="New Chat"
          kbd="Ctrl+K"
          compact={sidebarCollapsed}
          active={auxView === 'chat' && !activeSessionId}
          onClick={startNew}
        />
        <NavItem
          icon={Workflow}
          label="Process"
          compact={sidebarCollapsed}
          active={auxView === 'process'}
          onClick={() => setAuxView('process')}
        />
        <NavItem
          icon={Inbox}
          label="Emails"
          compact={sidebarCollapsed}
          active={auxView === 'emails'}
          onClick={() => setAuxView('emails')}
        />
        <NavItem
          icon={Star}
          label="My List"
          compact={sidebarCollapsed}
          active={auxView === 'mylist'}
          onClick={() => setAuxView('mylist')}
        />
      </nav>

      {!sidebarCollapsed && (
        <div className="mb-2 mt-5 px-4 text-[10px] font-mono uppercase tracking-[0.18em] text-nexus-muted">
          Recent
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto px-2">
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-sm text-nexus-muted">
            {sidebarCollapsed ? '…' : 'Your searches will appear here.'}
          </p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => openSession(s.id)}
            title={s.title || s.original_query}
            className={cn(
              'flex w-full items-start gap-2 rounded-lg text-sm transition-colors hover:bg-nexus-card/50',
              sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-left',
              auxView === 'chat' && activeSessionId === s.id && 'bg-nexus-card',
            )}
          >
            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nexus-muted" />
            {!sidebarCollapsed && (
              <span className="min-w-0 flex-1 truncate text-nexus-text">{s.title || s.original_query}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2 border-t border-nexus-border p-3">
        <div className="flex items-center gap-2 px-1 py-1">
          {AUTH_DISABLED ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nexus-accent/15 text-xs font-semibold text-nexus-accent">
              D
            </div>
          ) : (
            <UserButton
              appearance={{
                elements: { avatarBox: 'w-8 h-8' },
              }}
            />
          )}
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-xs text-nexus-text">
                {userEmail || (AUTH_DISABLED ? 'dev@local' : 'Signed in')}
              </div>
              <div className="text-[10px] text-nexus-muted">
                {AUTH_DISABLED ? 'Auth disabled' : 'Manage account'}
              </div>
            </div>
          )}
          <ThemeToggle />
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => openSettings('usage')}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-nexus-muted hover:bg-nexus-card hover:text-nexus-text"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 text-[11px] text-nexus-muted">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-nexus-text"
              onClick={() => openSettings('usage')}
            >
              <Settings className="h-3 w-3" />
              Settings
            </button>
            <button type="button" className="hover:text-nexus-text" onClick={() => openSettings('system')}>
              System
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-nexus-text"
              onClick={() => showToast('info', 'English is the only supported language for now.')}
            >
              <Globe className="h-3 w-3" />
              Language
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  kbd?: string
  active?: boolean
  compact?: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, kbd, active, compact, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-lg border text-sm transition-colors',
        compact ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
        active
          ? 'border-nexus-border bg-nexus-card text-nexus-text'
          : 'border-transparent text-nexus-muted hover:bg-nexus-elevated/60 hover:text-nexus-text',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!compact && kbd && (
        <span className="shrink-0 rounded border border-nexus-border px-1.5 py-0.5 font-mono text-[10px] text-nexus-muted">
          {kbd}
        </span>
      )}
    </button>
  )
}

export type { AuxView }
