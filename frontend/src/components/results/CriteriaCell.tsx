import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function CriteriaCell({
  matched,
  text,
}: {
  matched: boolean | null
  text?: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full border',
          matched === true && 'border-emerald-500/30 bg-emerald-500/12 text-emerald-400',
          matched === false && 'border-red-500/30 bg-red-500/12 text-red-400',
          matched == null && 'border-nexus-border bg-nexus-elevated text-nexus-muted',
        )}
      >
        {matched === true ? (
          <Check className="h-3.5 w-3.5" />
        ) : matched === false ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      {text ? (
        <span className="block truncate text-xs text-nexus-muted" title={text}>
          {text}
        </span>
      ) : (
        <span className="text-xs text-nexus-muted">—</span>
      )}
    </div>
  )
}
