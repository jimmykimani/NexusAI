import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  ExternalLink,
  Gauge,
  HelpCircle,
  Loader2,
  Mail,
  Play,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  UserCircle2,
  X,
} from 'lucide-react'
import { api, apiErrorMessage } from '@/api/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useMetrics } from '@/hooks/useMetrics'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/authStore'
import { useSearchStore } from '@/stores/searchStore'
import { type SettingsTab, useUIStore } from '@/stores/uiStore'
import type { AdminLogsResponse, AgentLog, MetricsSummary } from '@/types'

const PAGE_SIZE = 6

type UsageEntry = {
  id: string
  detail: string
  date: string
  tokenCount: number
  children: Array<{ id: string; detail: string; date: string; tokenCount: number }>
}

export function SettingsModal() {
  const open = useUIStore((state) => state.settingsOpen)
  const close = useUIStore((state) => state.closeSettings)
  const activeTab = useUIStore((state) => state.settingsTab)
  const setActiveTab = useUIStore((state) => state.setSettingsTab)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-[min(90vh,920px)] w-full max-w-[1320px] overflow-hidden rounded-[30px] border border-nexus-border bg-nexus-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-nexus-border bg-gradient-to-b from-nexus-card to-nexus-surface p-5">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.24em] text-nexus-muted">Settings</div>
            <div className="mt-2 text-sm leading-6 text-nexus-subtle">
              One place for workspace controls, usage, system health, evals, and logs.
            </div>
          </div>

          <div className="space-y-1.5">
            <SettingsNavItem
              icon={<UserCircle2 className="h-4 w-4" />}
              label="Profile"
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            />
            <SettingsNavItem
              icon={<Gauge className="h-4 w-4" />}
              label="Usage"
              active={activeTab === 'usage'}
              onClick={() => setActiveTab('usage')}
            />
            <SettingsNavItem
              icon={<Settings2 className="h-4 w-4" />}
              label="Workspace"
              active={activeTab === 'workspace'}
              onClick={() => setActiveTab('workspace')}
            />
            <SettingsNavItem
              icon={<Mail className="h-4 w-4" />}
              label="Email Address"
              active={activeTab === 'email'}
              onClick={() => setActiveTab('email')}
            />
            <SettingsNavItem
              icon={<HelpCircle className="h-4 w-4" />}
              label="Get Help"
              active={activeTab === 'help'}
              onClick={() => setActiveTab('help')}
              external
            />
            <SettingsNavItem
              icon={<ShieldCheck className="h-4 w-4" />}
              label="System"
              active={activeTab === 'system'}
              onClick={() => setActiveTab('system')}
            />
          </div>

          <div className="mt-auto rounded-2xl border border-nexus-border bg-nexus-bg/70 p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-nexus-muted">Theme</div>
            <ThemeToggle variant="labeled" />
          </div>
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b border-nexus-border px-7">
            <div>
              <h2 className="text-base font-semibold">{settingsHeading(activeTab)}</h2>
              <p className="text-xs text-nexus-muted">{settingsSubheading(activeTab)}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-7 py-6">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'usage' && <UsageTab />}
            {activeTab === 'workspace' && <WorkspaceTab />}
            {activeTab === 'email' && <EmailAddressTab />}
            {activeTab === 'help' && <HelpTab />}
            {activeTab === 'system' && <SystemTab />}
          </div>
        </section>
      </div>
    </div>
  )
}

function SettingsNavItem({
  icon,
  label,
  active,
  onClick,
  external,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
  external?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm transition-colors',
        active
          ? 'border-nexus-text bg-nexus-card font-medium text-nexus-text shadow-sm'
          : 'border-transparent text-nexus-muted hover:border-nexus-border hover:bg-nexus-card/70 hover:text-nexus-text',
      )}
    >
      {icon}
      {label}
      {external && <ExternalLink className="ml-auto h-3.5 w-3.5" />}
    </button>
  )
}

function ProfileTab() {
  const user = useAuthStore((state) => state.user)
  const sessions = useSearchStore((state) => state.sessions)
  const latestSession = sessions[0] ?? null

  return (
    <div className="space-y-6">
      <PanelCard>
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-nexus-accent/12 font-semibold text-nexus-accent">
            {initialsFor(user?.full_name || user?.email || 'NA')}
          </div>
          <div>
            <div className="text-xl font-semibold text-nexus-text">{user?.full_name || 'NexusAI User'}</div>
            <div className="text-sm text-nexus-muted">{user?.email || 'Development session'}</div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <MetricCard label="Searches" value={String(sessions.length)} />
          <MetricCard
            label="Completed"
            value={String(sessions.filter((session) => session.status === 'complete').length)}
          />
          <MetricCard label="Latest Search" value={latestSession?.title || 'No searches yet'} compact />
        </div>
      </PanelCard>
    </div>
  )
}

function UsageTab() {
  const sessions = useSearchStore((state) => state.sessions)
  const sessionTimings = useSearchStore((state) => state.sessionTimings)
  const { data } = useMetrics()
  const [page, setPage] = useState(1)

  const entries = useMemo<UsageEntry[]>(
    () =>
      sessions.map((session) => ({
        id: session.id,
        detail: session.title || session.original_query,
        date: session.created_at,
        tokenCount: session.total_tokens ?? 0,
        children: [
          {
            id: `${session.id}-status`,
            detail:
              session.status === 'complete'
                ? `Search people · ${session.lead_count} leads`
                : `Search ${session.status}`,
            date: session.created_at,
            tokenCount: session.total_tokens ?? 0,
          },
          ...(sessionTimings[session.id]
            ? [
                {
                  id: `${session.id}-latency`,
                  detail: `Latency ${formatDuration(sessionTimings[session.id])}`,
                  date: session.created_at,
                  tokenCount: 0,
                },
              ]
            : []),
        ],
      })),
    [sessions, sessionTimings],
  )

  const totalTokens = data?.summary?.total_tokens ?? 0
  const totalInputTokens = data?.summary?.input_tokens ?? 0
  const totalOutputTokens = data?.summary?.output_tokens ?? 0
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PanelCard className="bg-gradient-to-br from-nexus-card to-nexus-bg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 text-lg font-semibold text-nexus-text">Workspace Usage</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <UsageStat label="Total Tokens" value={formatCount(totalTokens)} accent />
              <UsageStat label="Input Tokens" value={formatCount(totalInputTokens)} />
              <UsageStat label="Output Tokens" value={formatCount(totalOutputTokens)} />
              <UsageStat label="Tracked Searches" value={String(entries.length)} />
            </div>
          </div>
          <div className="rounded-xl border border-nexus-border bg-nexus-card px-4 py-3 text-sm text-nexus-muted">
            Backend tracked
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-nexus-text">Usage History</h3>
          <span className="text-xs text-nexus-muted">{entries.length} tracked turns</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nexus-border">
              <th className="w-8 py-2 text-left text-xs font-normal text-nexus-muted" />
              <th className="py-2 text-left text-xs font-normal text-nexus-muted">Detail</th>
              <th className="py-2 text-left text-xs font-normal text-nexus-muted">Date</th>
              <th className="py-2 text-right text-xs font-normal text-nexus-muted">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {pageEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-nexus-muted">
                  Search history will appear here once you run a query.
                </td>
              </tr>
            ) : (
              pageEntries.map((entry) => <UsageRow key={entry.id} entry={entry} />)
            )}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between text-xs text-nexus-muted">
          <span>{entries.length} in total</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-nexus-border px-2 py-1 hover:bg-nexus-card"
              disabled={page === 1}
            >
              Prev
            </button>
            <span>
              {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="rounded-md border border-nexus-border px-2 py-1 hover:bg-nexus-card"
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}

function UsageRow({ entry }: { entry: UsageEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = entry.children.length > 0
  const isPositive = entry.tokenCount > 0

  return (
    <>
      <tr
        className={cn(
          'border-b border-nexus-border/50 transition-colors',
          hasChildren && 'cursor-pointer hover:bg-nexus-card/30',
        )}
        onClick={() => {
          if (hasChildren) setExpanded((value) => !value)
        }}
      >
        <td className="py-3">
          {hasChildren && (
            <ChevronRight className={cn('h-4 w-4 text-nexus-muted transition-transform', expanded && 'rotate-90')} />
          )}
        </td>
        <td className="py-3 text-sm text-nexus-text">{entry.detail}</td>
        <td className="py-3 font-mono text-sm text-nexus-muted">{formatDate(entry.date)}</td>
        <td
          className={cn(
            'py-3 text-right font-mono text-sm',
            isPositive ? 'text-emerald-500' : 'text-nexus-muted',
          )}
        >
          {formatCount(entry.tokenCount)}
        </td>
      </tr>
      {expanded &&
        entry.children.map((child) => (
          <tr key={child.id} className="border-b border-nexus-border/30 bg-nexus-card/20">
            <td className="py-2" />
            <td className="py-2 pl-4 text-xs text-nexus-muted">{child.detail}</td>
            <td className="py-2 font-mono text-xs text-nexus-muted">{formatDate(child.date)}</td>
            <td className="py-2 text-right font-mono text-xs text-nexus-muted">
              {formatCount(child.tokenCount)}
            </td>
          </tr>
        ))}
    </>
  )
}

function WorkspaceTab() {
  const grouping = useUIStore((state) => state.resultsGrouping)
  const toggleGrouping = useUIStore((state) => state.toggleResultsGrouping)
  const pipelineMode = useUIStore((state) => state.pipelineMode)
  const setPipelineMode = useUIStore((state) => state.setPipelineMode)

  return (
    <div className="space-y-5">
      <PanelCard>
        <div className="mb-3 text-sm font-semibold text-nexus-text">Appearance</div>
        <ThemeToggle variant="labeled" />
      </PanelCard>
      <PanelCard>
        <div className="mb-3 text-sm font-semibold text-nexus-text">Results table</div>
        <button
          type="button"
          onClick={toggleGrouping}
          className="rounded-xl border border-nexus-border px-3 py-2 text-sm text-nexus-text transition-colors hover:bg-nexus-elevated"
        >
          Grouping mode: {grouping === 'grouped' ? 'Grouped by match' : 'Flat list'}
        </button>
      </PanelCard>
      <PanelCard>
        <div className="mb-3 text-sm font-semibold text-nexus-text">Pipeline mode</div>
        <div className="flex flex-wrap gap-2">
          <TogglePill label="Nexus Pipeline" active={pipelineMode === 'nexus'} onClick={() => setPipelineMode('nexus')} />
          <TogglePill label="Basic Pipeline" active={pipelineMode === 'basic'} onClick={() => setPipelineMode('basic')} />
        </div>
        <div className="mt-3 text-sm text-nexus-muted">
          Use this before/after switch to compare the full NexusAI ranking path against the simpler baseline heuristic.
        </div>
      </PanelCard>
      <PanelCard>
        <div className="mb-3 text-sm font-semibold text-nexus-text">Keyboard shortcuts</div>
        <div className="space-y-2 text-sm text-nexus-muted">
          <div>Ctrl/Cmd + K focuses the active search input.</div>
          <div>Ctrl/Cmd + E opens outreach when leads are selected.</div>
          <div>Escape closes the currently open modal or panel.</div>
        </div>
      </PanelCard>
    </div>
  )
}

function EmailAddressTab() {
  const user = useAuthStore((state) => state.user)
  const isSignedIn = useAuthStore((state) => state.isSignedIn)

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="mb-1 text-sm font-semibold text-nexus-text">Primary email</div>
        <div className="text-sm text-nexus-muted">{user?.email || 'Not available in this session'}</div>
      </PanelCard>
      <PanelCard>
        <div className="mb-1 text-sm font-semibold text-nexus-text">Auth mode</div>
        <div className="text-sm text-nexus-muted">
          {isSignedIn ? 'Signed in' : 'Development / local mode'}
        </div>
      </PanelCard>
    </div>
  )
}

function HelpTab() {
  return (
    <div className="space-y-4">
      <HelpCard
        title="Search tips"
        body="Use role, location, company, and signals like followers or industry to get better matches."
      />
      <HelpCard
        title="Feedback loop"
        body="After each search, NexusAI now keeps the conversation moving with a short assistant recap and suggested next refinements."
      />
      <HelpCard
        title="System visibility"
        body="Health, evals, observability, and recent logs all live under the System tab now, so you do not have to bounce into a separate page."
      />
    </div>
  )
}

function SystemTab() {
  const { data, isLoading, isRunningEval, error, refresh, runEval } = useMetrics()
  const pipelineMode = useUIStore((state) => state.pipelineMode)
  const setPipelineMode = useUIStore((state) => state.setPipelineMode)
  const sessions = useSearchStore((state) => state.sessions)
  const leads = useSearchStore((state) => state.leads)
  const streamEvents = useSearchStore((state) => state.streamEvents)
  const lastSearchElapsedMs = useSearchStore((state) => state.lastSearchElapsedMs)
  const sessionTimings = useSearchStore((state) => state.sessionTimings)
  const leadFeedback = useSearchStore((state) => state.leadFeedback)
  const sessionFeedback = useSearchStore((state) => state.sessionFeedback)

  const [logs, setLogs] = useState<AgentLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)

  const completed = sessions.filter((session) => session.status === 'complete')
  const successRate = sessions.length === 0 ? 0 : Math.round((completed.length / sessions.length) * 100)
  const avgLeadCount =
    completed.length === 0
      ? 0
      : Math.round(completed.reduce((sum, session) => sum + session.lead_count, 0) / completed.length)
  const timingValues = Object.values(sessionTimings)
  const avgLatency =
    timingValues.length === 0
      ? 0
      : Math.round(timingValues.reduce((sum, value) => sum + value, 0) / timingValues.length)
  const positiveFeedback =
    Object.values(leadFeedback).filter((value) => value === 'positive').length +
    Object.values(sessionFeedback).filter((value) => value === 'positive').length
  const negativeFeedback =
    Object.values(leadFeedback).filter((value) => value === 'negative').length +
    Object.values(sessionFeedback).filter((value) => value === 'negative').length
  const waterfall = useMemo(
    () => buildWaterfall(streamEvents, lastSearchElapsedMs),
    [streamEvents, lastSearchElapsedMs],
  )
  const longestStage = waterfall.reduce((max, item) => Math.max(max, item.ms), 0)

  async function loadLogs() {
    try {
      const response = await api.get<AdminLogsResponse>('/admin/agent-logs', {
        params: { limit: 40 },
      })
      setLogs(response.data.logs)
      setLogsError(null)
    } catch (err) {
      setLogsError(apiErrorMessage(err))
    } finally {
      setLogsLoading(false)
    }
  }

  async function refreshAll() {
    await Promise.all([refresh(), loadLogs()])
  }

  useEffect(() => {
    void loadLogs()
  }, [])

  if (isLoading && !data) {
    return <div className="text-sm text-nexus-muted">Loading system metrics…</div>
  }

  return (
    <div className="space-y-5">
      {(error || logsError) && (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {[error, logsError].filter(Boolean).join(' ')}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PanelCard className="bg-gradient-to-br from-nexus-surface/80 to-nexus-card/40 border-nexus-accent/30 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-nexus-text">Health and runtime</div>
              <div className="text-xs text-nexus-muted">Backend status, provider, prompt version, and live counters.</div>
            </div>
            <button type="button" onClick={() => void refreshAll()} className="btn-ghost">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="Prompt Version" value={data?.health.prompt_version || '—'} compact />
            <MetricCard label="LLM Provider" value={data?.health.llm_provider || '—'} compact />
            <MetricCard label="Pipeline Mode" value={pipelineMode === 'nexus' ? 'Nexus' : 'Basic'} compact />
          </div>

          <SystemHealthGrid data={data} />
        </PanelCard>

        <PanelCard>
          <div className="mb-4 text-sm font-semibold text-nexus-text">Workspace snapshot</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Tracked Searches" value={String(sessions.length)} />
            <MetricCard label="Success Rate" value={`${successRate}%`} />
            <MetricCard label="Avg Leads / Run" value={String(avgLeadCount)} />
            <MetricCard label="Avg Latency" value={avgLatency > 0 ? formatDuration(avgLatency) : '—'} />
            <MetricCard label="Helpful Feedback" value={String(positiveFeedback)} />
            <MetricCard label="Not Helpful" value={String(negativeFeedback)} />
          </div>

          <div className="mt-5 border-t border-nexus-border pt-4">
            <div className="mb-3 text-sm font-semibold text-nexus-text">Pipeline mode</div>
            <div className="flex flex-wrap gap-2">
              <TogglePill label="Nexus Pipeline" active={pipelineMode === 'nexus'} onClick={() => setPipelineMode('nexus')} />
              <TogglePill label="Basic Pipeline" active={pipelineMode === 'basic'} onClick={() => setPipelineMode('basic')} />
            </div>
            <p className="mt-3 text-sm text-nexus-muted">
              New searches will stream using the selected pipeline, and the logs below reflect that same mode.
            </p>
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <EvalCard data={data} isRunningEval={isRunningEval} onRunEval={runEval} />

        <PanelCard>
          <div className="mb-4 text-sm font-semibold text-nexus-text">Latest search observability</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Visible Leads" value={String(leads.length)} />
            <MetricCard
              label="Live Events"
              value={String(streamEvents.filter((event) => event.type !== 'persona_chunk').length)}
            />
          </div>

          <div className="mt-5 border-t border-nexus-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-nexus-text">Latency waterfall</div>
                <div className="text-xs text-nexus-muted">Latest streamed search pipeline</div>
              </div>
              {lastSearchElapsedMs != null && (
                <span className="rounded-full border border-nexus-border px-3 py-1 text-xs text-nexus-muted">
                  Total {formatDuration(lastSearchElapsedMs)}
                </span>
              )}
            </div>

            {waterfall.length === 0 ? (
              <div className="text-sm text-nexus-muted">Run a search to populate the stage waterfall.</div>
            ) : (
              <div className="space-y-3">
                {waterfall.map((stage) => (
                  <div key={stage.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-nexus-text">{stage.label}</span>
                      <span className="font-mono text-xs text-nexus-muted">{formatDuration(stage.ms)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-nexus-elevated">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          stage.id === 'supervisor' && 'bg-nexus-accent',
                          stage.id === 'search' && 'bg-emerald-400',
                          stage.id === 'ranking' && 'bg-amber-400',
                          waterfallWidthClass(stage.ms, longestStage),
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PanelCard>
      </div>

      <PanelCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-nexus-text">Recent agent logs</div>
            <div className="text-xs text-nexus-muted">Observability stays here in settings now, with enough width to actually read the checkpoints.</div>
          </div>
          <button type="button" onClick={() => void loadLogs()} className="btn-ghost">
            <RefreshCcw className="h-4 w-4" />
            Refresh logs
          </button>
        </div>
        <SystemLogsTable logs={logs} isLoading={logsLoading} />
      </PanelCard>
      
      <PanelCard className="bg-gradient-to-r from-nexus-card to-nexus-bg border-indigo-500/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-nexus-text flex items-center gap-2">
               <ShieldCheck className="w-5 h-5 text-indigo-400" />
               LangSmith Tracing
            </div>
            <div className="text-sm text-nexus-muted mt-1">Deep infrastructure observability. To see your true agentic trace waterfalls, please review your LangSmith project.</div>
          </div>
          <a
            href="https://smith.langchain.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary bg-indigo-600 hover:bg-indigo-700 !text-white"
          >
            Open LangSmith Dashboard
          </a>
        </div>
      </PanelCard>
    </div>
  )
}

function SystemLogsTable({
  logs,
  isLoading,
}: {
  logs: AgentLog[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-nexus-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading logs…
      </div>
    )
  }

  if (logs.length === 0) {
    return <div className="text-sm text-nexus-muted">Run a search to populate agent logs.</div>
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-nexus-border bg-nexus-bg/35">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-nexus-border bg-nexus-card/70 text-left text-[11px] uppercase tracking-[0.18em] text-nexus-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Latency</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Prompt</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-nexus-border/60 align-top transition-colors hover:bg-nexus-card/35"
              >
                <td className="px-4 py-3 text-xs text-nexus-muted">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-3 font-medium text-nexus-text">{humanizeStage(log.stage)}</td>
                <td className="px-4 py-3 text-nexus-muted">{log.event_type}</td>
                <td className="px-4 py-3 text-nexus-muted">{log.pipeline_mode}</td>
                <td className="px-4 py-3 font-mono text-xs text-nexus-muted">
                  {log.latency_ms != null ? formatDuration(log.latency_ms) : '—'}
                </td>
                <td className="px-4 py-3 text-nexus-text">{log.message || '—'}</td>
                <td className="px-4 py-3 text-nexus-muted">{log.prompt_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EvalCard({
  data,
  isRunningEval,
  onRunEval,
}: {
  data: MetricsSummary | null
  isRunningEval: boolean
  onRunEval: () => Promise<unknown>
}) {
  const latest = data?.latest_eval
  return (
    <PanelCard>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-nexus-text">Observability + evals</div>
          <div className="text-xs text-nexus-muted">
            Golden query runner with MRR, Precision@5, and Recall@10.
          </div>
        </div>
        <button type="button" onClick={() => void onRunEval()} className="btn-primary" disabled={isRunningEval}>
          <Play className="h-4 w-4" />
          {isRunningEval ? 'Running…' : 'Run eval'}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="MRR" value={latest ? latest.mrr.toFixed(2) : '—'} />
        <MetricCard label="Precision@5" value={latest ? latest.precision_at_5.toFixed(2) : '—'} />
        <MetricCard label="Recall@10" value={latest ? latest.recall_at_10.toFixed(2) : '—'} />
      </div>
      <div className="mt-4 space-y-3">
        <ScoreBar label="MRR" value={latest?.mrr ?? 0} tone="emerald" />
        <ScoreBar label="Precision@5" value={latest?.precision_at_5 ?? 0} tone="sky" />
        <ScoreBar label="Recall@10" value={latest?.recall_at_10 ?? 0} tone="amber" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetricCard label="Dataset Size" value={latest ? String(latest.dataset_size) : '20'} />
        <MetricCard label="Last Run" value={latest ? formatDateTime(latest.created_at) : 'Not yet run'} compact />
      </div>
    </PanelCard>
  )
}

function SystemHealthGrid({ data }: { data: MetricsSummary | null }) {
  const health = data?.health
  const summary = data?.summary
  const latency = data?.latency
  const pipeline = data?.pipeline_modes

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="API" value={health?.api || '—'} />
      <MetricCard label="Database" value={health?.database || '—'} />
      <MetricCard label="LLM Provider" value={health?.llm_provider || '—'} compact />
      <MetricCard label="Prompt Version" value={health?.prompt_version || '—'} compact />
      <MetricCard label="Searches Run" value={String(summary?.searches_run ?? 0)} />
      <MetricCard label="Success Rate" value={`${summary?.success_rate ?? 0}%`} />
      <MetricCard label="Avg Latency" value={latency?.avg_ms ? formatDuration(latency.avg_ms) : '—'} />
      <MetricCard label="P95 Latency" value={latency?.p95_ms ? formatDuration(latency.p95_ms) : '—'} />
      <MetricCard label="Helpful Feedback" value={String(summary?.helpful_feedback ?? 0)} />
      <MetricCard label="Not Helpful" value={String(summary?.not_helpful_feedback ?? 0)} />
      <MetricCard label="Nexus Runs" value={String(pipeline?.nexus ?? 0)} />
      <MetricCard label="Basic Runs" value={String(pipeline?.basic ?? 0)} />
    </div>
  )
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm transition-colors',
        active
          ? 'border-nexus-text bg-nexus-text text-nexus-bg'
          : 'border-nexus-border bg-nexus-card text-nexus-muted hover:text-nexus-text',
      )}
    >
      {label}
    </button>
  )
}

function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <PanelCard>
      <div className="mb-1 text-sm font-semibold text-nexus-text">{title}</div>
      <div className="text-sm text-nexus-muted">{body}</div>
    </PanelCard>
  )
}

function MetricCard({
  label,
  value,
  compact,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className="rounded-2xl border border-nexus-border/70 bg-nexus-bg/45 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-nexus-muted">{label}</div>
      <div className={cn('mt-2 font-semibold text-nexus-text', compact ? 'truncate text-sm' : 'text-xl md:text-2xl')}>
        {value}
      </div>
    </div>
  )
}

function UsageStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-nexus-border/70 bg-nexus-bg/40 px-4 py-3">
      <div className={cn('text-xs uppercase tracking-[0.16em]', accent ? 'text-nexus-accent' : 'text-nexus-muted')}>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-nexus-text">{value}</div>
    </div>
  )
}

function PanelCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('rounded-[24px] border border-nexus-border bg-nexus-card p-5', className)}>{children}</div>
}

function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'emerald' | 'sky' | 'amber'
}) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%`
  const toneClass = tone === 'emerald' ? 'bg-emerald-500' : tone === 'sky' ? 'bg-sky-500' : 'bg-amber-500'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-nexus-text">{label}</span>
        <span className="font-mono text-xs text-nexus-muted">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-nexus-elevated">
        <div className={cn('h-full rounded-full', toneClass)} style={{ width }} />
      </div>
    </div>
  )
}

function settingsHeading(tab: SettingsTab): string {
  switch (tab) {
    case 'profile':
      return 'Profile'
    case 'usage':
      return 'Usage'
    case 'workspace':
      return 'Workspace'
    case 'email':
      return 'Email Address'
    case 'help':
      return 'Get Help'
    case 'system':
      return 'System'
  }
}

function settingsSubheading(tab: SettingsTab): string {
  switch (tab) {
    case 'profile':
      return 'Identity and workspace summary.'
    case 'usage':
      return 'Backend token usage and search activity.'
    case 'workspace':
      return 'Workspace behavior and search table controls.'
    case 'email':
      return 'Primary account contact details.'
    case 'help':
      return 'Tips for getting better results.'
    case 'system':
      return 'Backend health, evals, observability, and logs.'
  }
}

function initialsFor(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function humanizeStage(stage: string): string {
  if (stage === 'intro') return 'Intro narrative'
  if (stage === 'outro') return 'Outro narrative'
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function buildWaterfall(
  events: Array<{ type: string; client_received_at?: number }>,
  elapsedMs: number | null,
): Array<{ id: 'supervisor' | 'search' | 'ranking'; label: string; ms: number }> {
  if (!elapsedMs || events.length === 0) return []

  const stamped = events.filter((event) => typeof event.client_received_at === 'number')
  if (stamped.length === 0) return []

  const start = stamped[0]?.client_received_at ?? Date.now()
  const planAt = stamped.find((event) => event.type === 'plan')?.client_received_at ?? start
  const rankingAt = stamped.find((event) => event.type === 'ranking')?.client_received_at ?? planAt
  const completeAt = stamped.find((event) => event.type === 'complete')?.client_received_at ?? start + elapsedMs

  const supervisorMs = Math.max(planAt - start, Math.round(elapsedMs * 0.2), 80)
  const searchMs = Math.max(rankingAt - planAt, Math.round(elapsedMs * 0.5), 120)
  const rankingMs = Math.max(completeAt - rankingAt, elapsedMs - supervisorMs - searchMs, 80)

  return [
    { id: 'supervisor', label: 'Supervisor', ms: supervisorMs },
    { id: 'search', label: 'Search', ms: searchMs },
    { id: 'ranking', label: 'Ranking', ms: rankingMs },
  ]
}

function waterfallWidthClass(stageMs: number, maxMs: number): string {
  const ratio = Math.max(0.1, stageMs / Math.max(maxMs, 1))
  if (ratio >= 0.95) return 'w-full'
  if (ratio >= 0.85) return 'w-11/12'
  if (ratio >= 0.75) return 'w-10/12'
  if (ratio >= 0.65) return 'w-8/12'
  if (ratio >= 0.55) return 'w-7/12'
  if (ratio >= 0.45) return 'w-6/12'
  if (ratio >= 0.35) return 'w-5/12'
  if (ratio >= 0.25) return 'w-4/12'
  if (ratio >= 0.18) return 'w-3/12'
  return 'w-2/12'
}
