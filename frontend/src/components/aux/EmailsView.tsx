import { Edit3, Inbox, Mail, Send, StickyNote } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useState } from 'react'

type Tab = 'inbox' | 'sent' | 'drafts' | 'task'

/** Full-width "Emails" placeholder view — matches the Lessie layout. */
export function EmailsView() {
  const [tab, setTab] = useState<Tab>('inbox')
  return (
    <section className="flex-1 flex bg-nexus-bg min-w-0">
      <div className="w-[240px] border-r border-nexus-border bg-nexus-surface p-4 flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-nexus-muted px-2">Emails</h2>
        <button
          type="button"
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-nexus-card hover:brightness-110"
          disabled
          title="Composing from this view isn't wired up — use a lead's action menu instead."
        >
          <Edit3 className="w-4 h-4" />
          New Email
        </button>

        <nav className="space-y-1 mt-2 text-sm">
          <TabLink icon={Inbox} label="Inbox" active={tab === 'inbox'} onClick={() => setTab('inbox')} />
          <TabLink icon={Send} label="Sent" active={tab === 'sent'} onClick={() => setTab('sent')} />
          <TabLink icon={StickyNote} label="Drafts" active={tab === 'drafts'} onClick={() => setTab('drafts')} />
          <TabLink icon={Mail} label="Task" active={tab === 'task'} onClick={() => setTab('task')} />
        </nav>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="h-14 px-5 flex items-center border-b border-nexus-border">
          <h2 className="text-sm font-semibold capitalize">{tab}</h2>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-14 h-14 rounded-full border border-nexus-border flex items-center justify-center mb-4 bg-nexus-card">
            <Inbox className="w-6 h-6 text-nexus-muted" />
          </div>
          <h3 className="text-base font-medium">No Email yet</h3>
          <p className="text-sm text-nexus-muted mt-2 max-w-sm">
            Outreach emails composed from a lead appear here (mocked for the capstone demo).
          </p>
        </div>
      </div>
    </section>
  )
}

function TabLink({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
        active
          ? 'bg-nexus-elevated text-nexus-text border border-nexus-border'
          : 'text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated/60 border border-transparent',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
