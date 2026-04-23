import { ExternalLink, Mail, Copy, Github } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSearchStore } from '@/stores/searchStore'
import type { Lead } from '@/types'

/** Per-row action buttons: copy email, open LinkedIn/GitHub, compose. */
export function ActionMenu({ lead }: { lead: Lead }) {
  const showToast = useUIStore((s) => s.showToast)
  const openOutreach = useUIStore((s) => s.openOutreach)
  const clearSelection = useSearchStore((s) => s.clearSelection)
  const selectLead = useSearchStore((s) => s.selectLead)

  async function copyEmail() {
    if (!lead.email) {
      showToast('info', 'No email on file for this lead.')
      return
    }
    try {
      await navigator.clipboard.writeText(lead.email)
      showToast('success', 'Email copied to clipboard.')
    } catch {
      showToast('error', 'Could not copy to clipboard.')
    }
  }

  function composeOne() {
    clearSelection()
    selectLead(lead.id)
    openOutreach()
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={copyEmail}
        className="btn-ghost py-1 px-2"
        title="Copy email"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      {lead.linkedin_url && (
        <a
          href={lead.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost py-1 px-2"
          title="Open LinkedIn"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {lead.github_url && (
        <a
          href={lead.github_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost py-1 px-2"
          title="Open GitHub"
        >
          <Github className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={composeOne}
        className="btn-ghost py-1 px-2"
        title="Compose email"
      >
        <Mail className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
