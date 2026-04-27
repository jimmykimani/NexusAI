import { useEffect, useState } from 'react'
import { 
  Activity, 
  Cpu, 
  Database, 
  History, 
  Server, 
  Terminal,
  Zap
} from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'

export function SystemView() {
  const [metrics, setMetrics] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [mResp, lResp] = await Promise.all([
          api.get('/system/metrics'),
          api.get('/system/traces')
        ])
        setMetrics(mResp.data)
        setLogs(lResp.data.logs || [])
      } catch (err) {
        console.error('Failed to fetch system data', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-nexus-bg">
        <Activity className="w-8 h-8 text-nexus-accent animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-nexus-bg overflow-y-auto">
      <header className="px-8 py-6 border-b border-nexus-border">
        <div className="flex items-center gap-3 mb-1">
          <Server className="w-5 h-5 text-nexus-accent" />
          <h1 className="text-xl font-semibold tracking-tight">System Observability</h1>
        </div>
        <p className="text-sm text-nexus-muted">Real-time infrastructure health and agentic trace logs.</p>
      </header>

      <main className="p-8 space-y-8 max-w-7xl">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={Cpu} 
            label="CPU Usage" 
            value={`${metrics?.cpu_usage_percent?.toFixed(1) || 0}%`}
            sub="Host performance"
          />
          <MetricCard 
            icon={Database} 
            label="Memory (RSS)" 
            value={`${metrics?.memory_info?.rss_mb?.toFixed(0) || 0} MB`}
            sub="Process footprint"
          />
          <MetricCard 
            icon={Zap} 
            label="LLM P95" 
            value={`${metrics?.llm?.latency_p95_ms || 0}ms`}
            sub={`${metrics?.llm?.provider} latency`}
          />
          <MetricCard 
            icon={History} 
            label="Agent Retries" 
            value="Active"
            sub="Level 5 Orchestration"
            color="text-green-500"
          />
        </div>

        {/* Traces Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-nexus-muted" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-nexus-muted">Agent Traces</h2>
          </div>
          
          <div className="rounded-xl border border-nexus-border bg-nexus-card overflow-hidden">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-nexus-bg/50 border-b border-nexus-border">
                  <th className="px-4 py-3 font-medium text-nexus-muted">Timestamp</th>
                  <th className="px-4 py-3 font-medium text-nexus-muted">Stage</th>
                  <th className="px-4 py-3 font-medium text-nexus-muted">Event</th>
                  <th className="px-4 py-3 font-medium text-nexus-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border/50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-nexus-muted italic">
                      No trace logs found in current session.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-nexus-elevated/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-nexus-muted">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-nexus-elevated border border-nexus-border text-[11px] font-medium">
                          {log.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-nexus-text font-medium">
                        {log.event_type}
                      </td>
                      <td className="px-4 py-3">
                         <span className={cn(
                           "text-[11px] font-semibold",
                           log.status === 'success' ? 'text-green-500' : 'text-nexus-accent'
                         )}>
                           {log.status.toUpperCase()}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="p-5 rounded-2xl border border-nexus-border bg-nexus-card space-y-3">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-nexus-elevated border border-nexus-border">
        <Icon className="w-5 h-5 text-nexus-accent" />
      </div>
      <div>
        <p className="text-xs font-medium text-nexus-muted mb-1">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tight", color || "text-nexus-text")}>{value}</p>
        <p className="text-[11px] text-nexus-muted mt-1">{sub}</p>
      </div>
    </div>
  )
}
