import type { MouseEvent } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSearchStore } from '@/stores/searchStore'
import type { FeedbackRating } from '@/types'

interface ButtonProps {
  rating: FeedbackRating
  active: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}

function FeedbackButton({ rating, active, onClick }: ButtonProps) {
  const positive = rating === 'positive'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
        active
          ? positive
            ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-400'
            : 'border-red-500/30 bg-red-500/12 text-red-400'
          : 'border-transparent text-nexus-muted hover:border-nexus-border hover:bg-nexus-card hover:text-nexus-text',
      )}
      aria-label={positive ? 'Mark as helpful' : 'Mark as not helpful'}
      title={positive ? 'Helpful' : 'Not helpful'}
    >
      {positive ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
    </button>
  )
}

export function LeadFeedbackButtons({ leadId }: { leadId: string }) {
  const feedback = useSearchStore((state) => state.leadFeedback[leadId] ?? null)
  const submitFeedback = useSearchStore((state) => state.submitLeadFeedback)

  return (
    <div className="flex items-center gap-1">
      <FeedbackButton
        rating="positive"
        active={feedback === 'positive'}
        onClick={(e) => {
          e.stopPropagation()
          void submitFeedback(leadId, 'positive')
        }}
      />
      <FeedbackButton
        rating="negative"
        active={feedback === 'negative'}
        onClick={(e) => {
          e.stopPropagation()
          void submitFeedback(leadId, 'negative')
        }}
      />
    </div>
  )
}

export function SessionFeedbackRow({ sessionId }: { sessionId: string }) {
  const feedback = useSearchStore((state) => state.sessionFeedback[sessionId] ?? null)
  const submitFeedback = useSearchStore((state) => state.submitSessionFeedback)

  return (
    <div className="flex items-center gap-1">
      <FeedbackButton
        rating="positive"
        active={feedback === 'positive'}
        onClick={() => {
          void submitFeedback(sessionId, 'positive')
        }}
      />
      <FeedbackButton
        rating="negative"
        active={feedback === 'negative'}
        onClick={() => {
          void submitFeedback(sessionId, 'negative')
        }}
      />
    </div>
  )
}
