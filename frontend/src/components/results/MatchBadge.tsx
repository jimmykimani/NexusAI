import type { MatchStatus } from '@/types'

interface Props {
  status: MatchStatus
  score: number
}

/** Small match pill matching Lessie's "●93%" dashboard aesthetic. */
export function MatchBadge({ status, score }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  if (status === 'fully_matched') {
    return (
      <span className="match-pill">
        <span className="w-1.5 h-1.5 rounded-full bg-nexus-accent" />
        {pct}%
      </span>
    )
  }
  return (
    <span
      className="match-pill-muted"
      title="Partially matched — weaker or incomplete signal vs. your ask"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-nexus-muted" />
      <span className="text-nexus-muted">Partial</span>
      <span className="text-nexus-subtle tabular-nums">{pct}%</span>
    </span>
  )
}
