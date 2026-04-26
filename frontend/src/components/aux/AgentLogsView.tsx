import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { api, apiErrorMessage } from '@/api/client'
import type { AdminLogsResponse, AgentLog } from '@/types'

export function AgentLogsView() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const response = await api.get<AdminLogsResponse>('/admin/agent-logs', { params: { limit: 200 } })
      setLogs(response.data.logs)
      setError(null)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="flex-1 min-w-0 overflow-y-auto bg-nexus-bg">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-nexus-border bg-nexus-surface px-6 py-5 shadow-[0_22px_80px_-52px_rgba(15,23,42,0.35)]">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-nexus-muted">Agent Logs</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Recent pipeline checkpoints</h1>
            <p className="mt-2 text-sm text-nexus-muted">A full-width log surface so the system view doesn’t feel squeezed.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-nexus-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logs…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-nexus-border bg-nexus-surface shadow-[0_26px_90px_-54px_rgba(15,23,42,0.3)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-nexus-border bg-nexus-card/70 text-left text-xs uppercase tracking-[0.18em] text-nexus-muted">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-nexus-border/60 align-top transition-colors hover:bg-nexus-card/40">
                      <td className="px-4 py-3 text-xs text-nexus-muted">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-nexus-text">{log.stage}</td>
                      <td className="px-4 py-3 text-nexus-muted">{log.event_type}</td>
                      <td className="px-4 py-3 text-nexus-muted">{log.pipeline_mode}</td>
                      <td className="px-4 py-3 font-mono text-xs text-nexus-muted">{log.latency_ms != null ? `${(log.latency_ms / 1000).toFixed(2)}s` : '—'}</td>
                      <td className="px-4 py-3 text-nexus-text">{log.message || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-nexus-muted">{log.session_id || '—'}</td>
                      <td className="px-4 py-3 text-nexus-muted">{log.prompt_version}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-nexus-muted">
                        No logs yet. Run a search to populate this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}
