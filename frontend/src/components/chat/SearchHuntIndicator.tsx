import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { useSearchStore } from '@/stores/searchStore'
import type { StreamEvent } from '@/types'

type StageId = 'supervisor' | 'search' | 'ranking'

const STAGES: Array<{ id: StageId; label: string }> = [
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'search', label: 'Search' },
  { id: 'ranking', label: 'Ranking' },
]

export function SearchHuntIndicator() {
  const events = useSearchStore((state) => state.streamEvents)
  const isSearching = useSearchStore((state) => state.isSearching)
  const pipelineEvents = useMemo(
    () =>
      events.filter((event) =>
        ['plan', 'searching', 'found', 'ranking', 'complete', 'error'].includes(event.type),
      ),
    [events],
  )

  const activeStage = useMemo(
    () => inferActiveStage(pipelineEvents, isSearching),
    [pipelineEvents, isSearching],
  )
  if (!isSearching || pipelineEvents.length === 0) return null

  return (
    <div className="rounded-xl border border-nexus-border bg-nexus-card/70 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-nexus-muted">The Hunt</span>
        <span className="text-xs text-nexus-muted">Search pipeline in motion</span>
      </div>
      <div className="flex items-center gap-2">
        {STAGES.map((stage, index) => {
          const state = stageState(stage.id, activeStage)
          return (
            <div key={stage.id} className="flex flex-1 items-center gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'relative inline-flex h-3 w-3 shrink-0 rounded-full border',
                      state === 'done' && 'border-emerald-500/40 bg-emerald-500',
                      state === 'active' && 'border-nexus-accent/40 bg-nexus-accent animate-hunt-pulse',
                      state === 'idle' && 'border-nexus-border bg-nexus-elevated',
                    )}
                  >
                    {state === 'active' && (
                      <span className="absolute inset-[-4px] rounded-full border border-nexus-accent/35 animate-hunt-ring" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      state === 'active' && 'text-nexus-text',
                      state === 'done' && 'text-emerald-400',
                      state === 'idle' && 'text-nexus-muted',
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              </div>
              {index < STAGES.length - 1 && (
                <div className="relative h-px flex-1 overflow-hidden rounded bg-nexus-border">
                  {state !== 'idle' && (
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 rounded',
                        state === 'done'
                          ? 'w-full bg-emerald-500/70'
                          : 'w-1/2 bg-gradient-to-r from-nexus-accent via-nexus-teal to-transparent animate-hunt-travel',
                      )}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function inferActiveStage(events: StreamEvent[], isSearching: boolean): StageId {
  if (!isSearching || events.length === 0) return 'supervisor'

  let stage: StageId = 'supervisor'
  for (const event of events) {
    if (event.type === 'ranking' || event.type === 'complete') {
      stage = 'ranking'
      continue
    }
    if (event.type === 'plan' || event.type === 'found' || event.type === 'searching') {
      stage = event.data?.queries ? 'search' : stage
    }
  }
  return stage
}

function stageState(stage: StageId, activeStage: StageId): 'done' | 'active' | 'idle' {
  const order: StageId[] = ['supervisor', 'search', 'ranking']
  const stageIndex = order.indexOf(stage)
  const activeIndex = order.indexOf(activeStage)
  if (stageIndex < activeIndex) return 'done'
  if (stageIndex === activeIndex) return 'active'
  return 'idle'
}
