import { useMemo, type ReactNode } from 'react'
import { Activity, ArrowRight, Clock3, Cpu, Database, Gauge, Sparkles } from 'lucide-react'
import { useMetrics } from '@/hooks/useMetrics'
import { cn } from '@/lib/cn'
import { useUIStore } from '@/stores/uiStore'

export function SystemView() {
  const { data, isLoading, error, refresh } = useMetrics()
  const pipelineMode = useUIStore((s) => s.pipelineMode)
  const setPipelineMode = useUIStore((s) => s.setPipelineMode)
  const setAuxView = useUIStore((s) => s.setAuxView)

  const cards = useMemo(
    () =>
      data
        ? [
            { label: 'Total Tokens', value: formatNumber(data.summary.total_tokens), icon: Sparkles },
            { label: 'Searches Run', value: formatNumber(data.summary.searches_run), icon: Activity },
            { label: 'Success Rate', value: `${data.summary.success_rate}%`, icon: Gauge },
            { label: 'Avg Latency', value: formatDuration(data.latency.avg_ms), icon: Clock3 },
          ]
        : [],
    [data],
  )

  return (
    <section className="flex-1 min-w-0 overflow-y-auto bg-nexus-bg">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-nexus-border bg-nexus-surface px-6 py-5 shadow-[0_22px_80px_-52px_rgba(15,23,42,0.35)]">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-nexus-muted">System</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspace health and usage</h1>
            <p className="mt-2 max-w-2xl text-sm text-nexus-muted">
              Token usage now comes from backend-tracked model calls, and recent agent logs have their own workspace page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-nexus-border bg-nexus-card p-1">
              <button
                type="button"
                onClick={() => setPipelineMode('nexus')}
                className={cn('rounded-full px-4 py-2 text-sm transition-colors', pipelineMode === 'nexus' ? 'bg-nexus-text text-nexus-bg' : 'text-nexus-muted')}
              >
                Nexus Pipeline
              </button>
              <button
                type="button"
                onClick={() => setPipelineMode('basic')}
                className={cn('rounded-full px-4 py-2 text-sm transition-colors', pipelineMode === 'basic' ? 'bg-nexus-text text-nexus-bg' : 'text-nexus-muted')}
              >
                Basic Pipeline
              </button>
            </div>
            <button type="button" className="btn-ghost" onClick={() => void refresh()}>
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={() => setAuxView('logs')}>
              Open Agent Logs
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-[24px] border border-nexus-border bg-nexus-surface p-5 shadow-[0_16px_44px_-36px_rgba(15,23,42,0.4)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-nexus-muted">{card.label}</div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-nexus-card text-nexus-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-tight">{isLoading ? '…' : card.value}</div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-nexus-border bg-nexus-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Runtime status</h2>
                <p className="mt-1 text-sm text-nexus-muted">Live backend health, prompt version, provider, and throughput.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <StatusCard label="API" value={data?.health.api ?? '…'} icon={<Cpu className="h-4 w-4" />} />
              <StatusCard label="Database" value={data?.health.database ?? '…'} icon={<Database className="h-4 w-4" />} />
              <StatusCard label="Provider" value={data?.health.llm_provider ?? '…'} icon={<Sparkles className="h-4 w-4" />} />
              <StatusCard label="Prompt" value={data?.health.prompt_version ?? '…'} />
              <StatusCard label="Helpful Feedback" value={formatNumber(data?.summary.helpful_feedback ?? 0)} />
              <StatusCard label="Agent Logs" value={formatNumber(data?.summary.agent_logs ?? 0)} />
            </div>
          </div>

          <div className="rounded-[28px] border border-nexus-border bg-nexus-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Token breakdown</h2>
                <p className="mt-1 text-sm text-nexus-muted">Pulled from backend token accounting rather than a credit heuristic.</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <MetricLine label="Input tokens" value={formatNumber(data?.summary.input_tokens ?? 0)} />
              <MetricLine label="Output tokens" value={formatNumber(data?.summary.output_tokens ?? 0)} />
              <MetricLine label="Total tokens" value={formatNumber(data?.summary.total_tokens ?? 0)} strong />
            </div>
            <div className="mt-6 rounded-2xl border border-nexus-border bg-nexus-card/70 p-4 text-sm text-nexus-muted">
              New searches and follow-up turns will accumulate usage in the same conversation thread, so the sidebar thread and the usage cards stay aligned.
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-nexus-border bg-nexus-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Recent pipeline activity</h2>
              <p className="mt-1 text-sm text-nexus-muted">A quick preview before you jump into the dedicated logs page.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setAuxView('logs')}>
              View all
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {(data?.recent_logs ?? []).slice(0, 6).map((log) => (
              <div key={log.id} className="rounded-2xl border border-nexus-border bg-nexus-card/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-nexus-muted">
                  <span>{log.stage}</span>
                  <span className="rounded-full bg-nexus-bg px-2 py-1 normal-case tracking-normal text-nexus-subtle">{log.event_type}</span>
                  <span className="ml-auto text-[11px] normal-case tracking-normal">{formatDateTime(log.created_at)}</span>
                </div>
                <div className="mt-2 text-sm text-nexus-text">{log.message || 'No message'}</div>
              </div>
            ))}
            {!isLoading && (data?.recent_logs?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-nexus-border px-4 py-8 text-center text-sm text-nexus-muted">
                Run a search to populate system activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function StatusCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-nexus-border bg-nexus-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-nexus-muted">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-xl font-semibold">{value}</div>
    </div>
  )
}

function MetricLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-nexus-border bg-nexus-card/60 px-4 py-3">
      <span className="text-sm text-nexus-muted">{label}</span>
      <span className={cn('text-lg font-semibold', strong && 'text-nexus-accent')}>{value}</span>
    </div>
  )
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
