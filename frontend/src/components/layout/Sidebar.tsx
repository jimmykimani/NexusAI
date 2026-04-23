import { useEffect } from 'react'
import {
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

/** Left sidebar: nav + recent searches + user/footer. */
export function Sidebar() {
  const sessions = useSearchStore((s) => s.sessions)
  const activeId = useSearchStore((s) => s.activeSessionId)
  const loadSession = useSearchStore((s) => s.loadSession)
  const resetCurrent = useSearchStore((s) => s.resetCurrent)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const userEmail = useAuthStore((s) => s.user?.email)
  const auxView = useUIStore((s) => s.auxView)
  const setAuxView = useUIStore((s) => s.setAuxView)
  const showToast = useUIStore((s) => s.showToast)

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
    <aside className="flex flex-col w-[240px] shrink-0 bg-nexus-surface border-r border-nexus-border">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-nexus-border">
        <Sparkles className="w-5 h-5 text-nexus-accent" />
        <span className="font-semibold tracking-tight">NexusAI</span>
      </div>

      <nav className="px-2 pt-3 space-y-1">
        <NavItem
          icon={MessageSquarePlus}
          label="New Chat"
          kbd="Ctrl+K"
          active={auxView === 'chat' && !activeId}
          onClick={startNew}
        />
        <NavItem
          icon={Workflow}
          label="Process"
          active={auxView === 'process'}
          onClick={() => setAuxView('process')}
        />
        <NavItem
          icon={Inbox}
          label="Emails"
          active={auxView === 'emails'}
          onClick={() => setAuxView('emails')}
        />
        <NavItem
          icon={Star}
          label="My List"
          active={auxView === 'mylist'}
          onClick={() => setAuxView('mylist')}
        />
      </nav>

      <div className="px-4 mt-5 mb-2 text-xs uppercase tracking-wider text-nexus-muted">
        Recent
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-sm text-nexus-muted px-3 py-2">
            Your searches will appear here.
          </p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => openSession(s.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-2',
              'hover:bg-nexus-card transition-colors',
              auxView === 'chat' && activeId === s.id && 'bg-nexus-card',
            )}
          >
            <Search className="w-3.5 h-3.5 mt-0.5 shrink-0 text-nexus-muted" />
            <span className="flex-1 min-w-0">
              <span className="block truncate text-nexus-text">
                {s.title || s.original_query}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-nexus-border p-3 space-y-2">
        <div className="flex items-center gap-2 px-1 py-1">
          {AUTH_DISABLED ? (
            <div className="w-8 h-8 rounded-full bg-nexus-accent/15 text-nexus-accent flex items-center justify-center text-xs font-semibold">
              D
            </div>
          ) : (
            <UserButton
              appearance={{
                elements: { avatarBox: 'w-8 h-8' },
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-nexus-text truncate">
              {userEmail || (AUTH_DISABLED ? 'dev@local' : 'Signed in')}
            </div>
            <div className="text-[10px] text-nexus-muted">
              {AUTH_DISABLED ? 'Auth disabled' : 'Manage account'}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between text-[11px] text-nexus-muted px-1">
          <button
            type="button"
            className="flex items-center gap-1 hover:text-nexus-text"
            onClick={() => showToast('info', 'Settings coming soon.')}
          >
            <Settings className="w-3 h-3" />
            Settings
          </button>
          <button
            type="button"
            className="hover:text-nexus-text"
            onClick={() => showToast('info', 'Thanks for trying NexusAI!')}
          >
            Feedback
          </button>
          <button
            type="button"
            className="flex items-center gap-1 hover:text-nexus-text"
            onClick={() => showToast('info', 'English is the only supported language for now.')}
          >
            <Globe className="w-3 h-3" />
            Language
          </button>
        </div>
      </div>
    </aside>
  )
}

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  kbd?: string
  active?: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, kbd, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-nexus-elevated text-nexus-text border border-nexus-border'
          : 'text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated/60 border border-transparent',
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {kbd && (
        <span className="text-[10px] font-mono text-nexus-muted px-1.5 py-0.5 rounded border border-nexus-border">
          {kbd}
        </span>
      )}
    </button>
  )
}

export type { AuxView }
