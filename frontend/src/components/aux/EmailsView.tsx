import { useEffect, useMemo, useState } from 'react'
import {
  Inbox,
  Loader2,
  MailCheck,
  Send,
} from 'lucide-react'
import { api, apiErrorMessage } from '@/api/client'
import type { SentEmail } from '@/types'

type Tab = 'sent' | 'recent' | 'targets'

type DeliveryTargetSummary = {
  id: string
  email: string
  count: number
  latestAt: string | null
  latestName: string | null
}

export function EmailsView() {
  const [tab, setTab] = useState<Tab>('sent')
  const [emails, setEmails] = useState<SentEmail[]>([])
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get<{ emails: SentEmail[] }>('/outreach/sent')
        setEmails(response.data.emails)
        setError(null)
      } catch (err) {
        setError(apiErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const deliveryTargets = useMemo<DeliveryTargetSummary[]>(
    () => {
      const grouped = emails.reduce((map, email) => {
          const existing = map.get(email.recipient_email)
          if (existing) {
            existing.count += 1
            if (!existing.latestAt || new Date(email.created_at) > new Date(existing.latestAt)) {
              existing.latestAt = email.created_at
              existing.latestName = email.recipient_name
            }
            return map
          }
          map.set(email.recipient_email, {
            id: email.recipient_email,
            email: email.recipient_email,
            count: 1,
            latestAt: email.created_at,
            latestName: email.recipient_name,
          })
          return map
        }, new Map<string, DeliveryTargetSummary>())

      return Array.from(grouped.values()).sort((a, b) => {
        if (!a.latestAt) return 1
        if (!b.latestAt) return -1
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
    },
    [emails],
  )

  const visibleEmails = useMemo(() => {
    if (tab === 'recent') return emails.slice(0, 8)
    if (tab === 'sent') return emails
    return []
  }, [emails, tab])

  const selectedEmail =
    visibleEmails.find((email) => email.id === selectedEmailId) ?? visibleEmails[0] ?? null
  const selectedTarget =
    deliveryTargets.find((target) => target.id === selectedTargetId) ?? deliveryTargets[0] ?? null
  const targetEmails = useMemo(
    () =>
      selectedTarget
        ? emails.filter((email) => email.recipient_email === selectedTarget.email)
        : [],
    [emails, selectedTarget],
  )

  useEffect(() => {
    if (tab === 'targets') {
      setSelectedTargetId((current) =>
        deliveryTargets.some((target) => target.id === current) ? current : deliveryTargets[0]?.id ?? null,
      )
      return
    }
    setSelectedEmailId((current) =>
      visibleEmails.some((email) => email.id === current) ? current : visibleEmails[0]?.id ?? null,
    )
  }, [deliveryTargets, tab, visibleEmails])

  return (
    <section className="flex min-w-0 flex-1 bg-nexus-bg">
      <aside className="w-[232px] shrink-0 border-r border-nexus-border bg-nexus-surface px-4 py-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-nexus-muted">Emails</div>
          <div className="mt-2 text-base font-semibold text-nexus-text">Mailbox</div>
        </div>

        <nav className="space-y-1.5">
          <TabLink label="Sent" meta={`${emails.length} stored`} active={tab === 'sent'} onClick={() => setTab('sent')} />
          <TabLink label="Recent" meta={`${Math.min(emails.length, 8)} latest`} active={tab === 'recent'} onClick={() => setTab('recent')} />
          <TabLink label="Targets" meta={`${deliveryTargets.length} contacts`} active={tab === 'targets'} onClick={() => setTab('targets')} />
        </nav>

        <div className="mt-5 rounded-[20px] border border-nexus-border bg-nexus-card/60 p-3.5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-nexus-muted">Delivery Targets</div>
          <div className="mt-3 space-y-2">
            {deliveryTargets.slice(0, 4).map((target) => (
              <div
                key={target.id}
                className="rounded-2xl border border-nexus-border bg-nexus-surface px-3 py-2"
              >
                <div className="truncate text-sm font-medium text-nexus-text">
                  {target.latestName || target.email}
                </div>
                <div className="mt-1 truncate text-xs text-nexus-muted">{target.email}</div>
              </div>
            ))}
            {deliveryTargets.length === 0 && (
              <div className="text-sm text-nexus-muted">No delivery targets yet.</div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-nexus-border lg:border-b-0 lg:border-r">
          <div className="border-b border-nexus-border px-5 py-4">
            <div className="text-base font-semibold text-nexus-text">
              {tab === 'targets' ? 'Delivery targets' : tab === 'recent' ? 'Recent outreach' : 'Sent email history'}
            </div>
            <div className="mt-1 text-sm text-nexus-muted">
              {tab === 'targets'
                ? `${deliveryTargets.length} unique recipient${deliveryTargets.length === 1 ? '' : 's'}`
                : `${visibleEmails.length} message${visibleEmails.length === 1 ? '' : 's'}`}
            </div>
          </div>

          <div className="max-h-[calc(100vh-9.5rem)] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 px-5 py-5 text-sm text-nexus-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading outreach history…
              </div>
            ) : error ? (
              <div className="m-4 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : tab === 'targets' ? (
              deliveryTargets.length === 0 ? (
                <CompactEmptyList label="No targets yet" />
              ) : (
                <div className="p-3">
                  {deliveryTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setSelectedTargetId(target.id)}
                      className={`mb-2 w-full rounded-[20px] border px-4 py-3 text-left transition-colors ${
                        selectedTarget?.id === target.id
                          ? 'border-nexus-border bg-nexus-card text-nexus-text'
                          : 'border-transparent text-nexus-muted hover:border-nexus-border hover:bg-nexus-card/70 hover:text-nexus-text'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-nexus-text">
                            {target.latestName || target.email}
                          </div>
                          <div className="mt-1 truncate text-xs text-nexus-muted">{target.email}</div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-nexus-muted">
                          <div>{target.count} send{target.count === 1 ? '' : 's'}</div>
                          <div className="mt-1">{target.latestAt ? formatDate(target.latestAt) : '—'}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : visibleEmails.length === 0 ? (
              <CompactEmptyList label="No messages yet" />
            ) : (
              <div className="p-3">
                {visibleEmails.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`mb-2 w-full rounded-[20px] border px-4 py-3.5 text-left transition-colors ${
                      selectedEmail?.id === email.id
                        ? 'border-nexus-border bg-nexus-card text-nexus-text'
                        : 'border-transparent text-nexus-muted hover:border-nexus-border hover:bg-nexus-card/70 hover:text-nexus-text'
                    }`}
                  >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-nexus-text">
                            {email.recipient_name || email.recipient_email}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm leading-6 text-nexus-text/90">
                            {email.subject}
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm leading-6 text-nexus-subtle">
                            {email.body}
                          </div>
                      </div>
                      <div className="shrink-0 text-xs text-nexus-muted">{formatDate(email.created_at)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {isLoading ? (
            <DetailShell>
              <div className="flex items-center gap-2 text-sm text-nexus-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading message view…
              </div>
            </DetailShell>
          ) : error ? (
            <DetailShell>
              <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            </DetailShell>
          ) : tab === 'targets' ? (
            selectedTarget ? (
              <DetailShell>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-nexus-border pb-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.18em] text-nexus-muted">Target</div>
                    <h3 className="mt-2 text-xl font-semibold text-nexus-text">
                      {selectedTarget.latestName || selectedTarget.email}
                    </h3>
                    <div className="mt-1 text-sm text-nexus-muted">{selectedTarget.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <InlineStat label="Sends" value={String(selectedTarget.count)} />
                    <InlineStat
                      label="Last sent"
                      value={selectedTarget.latestAt ? formatDate(selectedTarget.latestAt) : '—'}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {targetEmails.map((email) => (
                    <article
                      key={email.id}
                      className="rounded-[22px] border border-nexus-border bg-nexus-card/55 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-nexus-muted">Subject</div>
                          <div className="mt-2 text-base font-medium text-nexus-text">{email.subject}</div>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-nexus-border bg-nexus-surface px-3 py-1 text-xs text-nexus-subtle">
                          <Send className="h-3.5 w-3.5" />
                          {email.status}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-nexus-muted">{formatDateTime(email.created_at)}</div>
                      <div className="mt-4 rounded-2xl border border-nexus-border bg-nexus-surface px-4 py-4 text-sm leading-7 text-nexus-subtle whitespace-pre-wrap">
                        {email.body}
                      </div>
                    </article>
                  ))}
                </div>
              </DetailShell>
            ) : (
              <EmptyEmailState />
            )
          ) : selectedEmail ? (
            <DetailShell>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-nexus-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-nexus-muted">
                    <MailCheck className="h-3.5 w-3.5" />
                    Delivered to
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-nexus-text">
                    {selectedEmail.recipient_name || selectedEmail.recipient_email}
                  </h3>
                  <div className="mt-1 text-sm text-nexus-muted">{selectedEmail.recipient_email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InlineStat label="Status" value={selectedEmail.status} />
                  <InlineStat label="Sent" value={formatDate(selectedEmail.created_at)} />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.18em] text-nexus-muted">Subject</div>
                <div className="mt-2 text-xl font-medium text-nexus-text">{selectedEmail.subject}</div>
              </div>

              <div className="mt-5 rounded-[24px] border border-nexus-border bg-nexus-card/55 px-5 py-5 text-[15px] leading-8 text-nexus-subtle whitespace-pre-wrap">
                {selectedEmail.body}
              </div>
            </DetailShell>
          ) : (
            <EmptyEmailState />
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

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-nexus-border bg-nexus-card px-3 py-1.5 text-xs text-nexus-muted">
      <span className="text-nexus-subtle">{label}</span>
      <span className="mx-1 text-nexus-muted/50">·</span>
      <span>{value}</span>
    </div>
  )
}

function CompactEmptyList({ label }: { label: string }) {
  return (
    <div className="px-5 py-10 text-sm text-nexus-muted">{label}</div>
  )
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto px-6 py-5">{children}</div>
}

function EmptyEmailState() {
  return (
    <DetailShell>
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-nexus-border bg-nexus-surface/70 px-6 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-nexus-border bg-nexus-card">
          <Inbox className="h-6 w-6 text-nexus-muted" />
        </div>
        <h3 className="mt-4 text-base font-semibold">No outreach yet</h3>
        <p className="mt-2 max-w-md text-sm text-nexus-muted">
          Generate and send emails from the results table, and they’ll show up here by thread and delivery target.
        </p>
      </div>
    </DetailShell>
  )
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], { month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
