import { useEffect, useMemo, useState } from 'react'
import { Sparkles, X, Loader2, Send } from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import { useOutreach } from '@/hooks/useOutreach'
import { EmailPreview } from './EmailPreview'
import type { ComposedEmail } from '@/types'

/** Compose + send outreach for selected leads. */
export function OutreachModal() {
  const open = useUIStore((s) => s.outreachModalOpen)
  const close = useUIStore((s) => s.closeOutreach)
  const selectedIds = useSearchStore((s) => s.selectedLeadIds)
  const leads = useSearchStore((s) => s.leads)
  const [context, setContext] = useState(
    'Reaching out about a collaboration opportunity at our company.',
  )
  const [senderName, setSenderName] = useState('')
  const [drafts, setDrafts] = useState<ComposedEmail[]>([])
  const { compose, isComposing, send, sendAll, isSending } = useOutreach()

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds],
  )

  useEffect(() => {
    if (!open) setDrafts([])
  }, [open])

  if (!open) return null

  async function generate() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const result = await compose(ids, context.trim(), senderName || undefined)
    setDrafts(result)
  }

  function updateDraft(index: number, next: ComposedEmail) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? next : d)))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="card w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 h-14 border-b border-nexus-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-nexus-accent" />
            <h2 className="text-sm font-semibold">
              Compose outreach · {selectedLeads.length} selected
            </h2>
          </div>
          <button type="button" onClick={close} className="btn-ghost py-1 px-2" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-nexus-muted mb-1">
                Your name (signature)
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Jane Doe"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs text-nexus-muted mb-1">
                Context / goal
              </label>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-nexus-muted">
              Claude will personalize each email with details from the lead's profile.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={generate}
              disabled={isComposing || selectedLeads.length === 0}
            >
              {isComposing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate emails
            </button>
          </div>

          {drafts.length === 0 && !isComposing && (
            <div className="text-sm text-nexus-muted py-6 text-center">
              Tune the context above, then generate drafts you can edit before sending.
            </div>
          )}

          {drafts.map((d, i) => (
            <EmailPreview
              key={d.lead_id}
              email={d}
              onChange={(next) => updateDraft(i, next)}
              onSend={send}
              sending={isSending}
            />
          ))}
        </div>

        {drafts.length > 0 && (
          <footer className="border-t border-nexus-border p-4 flex items-center justify-between">
            <span className="text-xs text-nexus-muted">
              {drafts.length} draft{drafts.length === 1 ? '' : 's'} ready
            </span>
            <button
              type="button"
              onClick={() => void sendAll(drafts)}
              disabled={isSending}
              className="btn-primary"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send all
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
