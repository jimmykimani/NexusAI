import type { SearchCriteria } from '@/types'

/** Inline criteria chips used inside chat messages. */
export function PlanDisplay({ criteria }: { criteria?: SearchCriteria }) {
  if (!criteria) return null

  const chips: string[] = []
  criteria.roles?.forEach((r) => chips.push(`role: ${r}`))
  if (criteria.location) chips.push(`location: ${criteria.location}`)
  if (criteria.industry) chips.push(`industry: ${criteria.industry}`)
  if (criteria.seniority) chips.push(`seniority: ${criteria.seniority}`)
  criteria.keywords?.forEach((k) => chips.push(k))
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs bg-nexus-bg border border-nexus-border text-nexus-muted/90"
        >
          {c}
        </span>
      ))}
    </div>
  )
}
