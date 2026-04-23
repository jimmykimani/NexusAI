import { Send, Loader2 } from 'lucide-react'
import type { ComposedEmail } from '@/types'

interface Props {
  email: ComposedEmail
  onChange: (next: ComposedEmail) => void
  onSend: (email: ComposedEmail) => void
  sending?: boolean
}

/** Editable email preview card used inside the outreach modal. */
export function EmailPreview({ email, onChange, onSend, sending }: Props) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs text-nexus-muted">
          To: <span className="text-nexus-text">{email.to_name || 'Lead'}</span>
        </div>
        <button
          type="button"
          onClick={() => onSend(email)}
          disabled={sending}
          className="btn-primary py-1.5 px-3"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send
        </button>
      </div>

      <div>
        <label className="block text-xs text-nexus-muted mb-1">Subject</label>
        <input
          value={email.subject}
          onChange={(e) => onChange({ ...email, subject: e.target.value })}
          className="input-base"
        />
      </div>

      <div>
        <label className="block text-xs text-nexus-muted mb-1">Body</label>
        <textarea
          value={email.body}
          onChange={(e) => onChange({ ...email, body: e.target.value })}
          className="input-base min-h-[160px] resize-y"
        />
      </div>
    </div>
  )
}
