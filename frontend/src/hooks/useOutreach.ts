import { useCallback, useState } from 'react'
import { api, apiErrorMessage } from '@/api/client'
import type { ComposeResponse, ComposedEmail, SendResponse } from '@/types'
import { useUIStore } from '@/stores/uiStore'

/**
 * Compose and (mock) send outreach emails for a batch of selected leads.
 */
export function useOutreach() {
  const [isComposing, setIsComposing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [emails, setEmails] = useState<ComposedEmail[]>([])
  const showToast = useUIStore((s) => s.showToast)

  const compose = useCallback(
    async (leadIds: string[], context: string, senderName?: string) => {
      setIsComposing(true)
      try {
        const { data } = await api.post<ComposeResponse>('/outreach/compose', {
          lead_ids: leadIds,
          context,
          sender_name: senderName,
        })
        setEmails(data.emails)
        return data.emails
      } catch (err) {
        showToast('error', `Compose failed: ${apiErrorMessage(err)}`)
        return []
      } finally {
        setIsComposing(false)
      }
    },
    [showToast],
  )

  const send = useCallback(
    async (email: ComposedEmail) => {
      setIsSending(true)
      try {
        const { data } = await api.post<SendResponse>('/outreach/send', {
          lead_id: email.lead_id,
          subject: email.subject,
          body: email.body,
          to_email: email.to_email,
        })
        showToast('success', `Sent to ${data.recipient_email} (${data.message_id})`)
        return true
      } catch (err) {
        showToast('error', `Send failed: ${apiErrorMessage(err)}`)
        return false
      } finally {
        setIsSending(false)
      }
    },
    [showToast],
  )

  const sendAll = useCallback(
    async (list: ComposedEmail[]) => {
      let ok = 0
      for (const e of list) {
        const result = await send(e)
        if (result) ok += 1
      }
      showToast('success', `Sent ${ok}/${list.length} emails.`)
    },
    [send, showToast],
  )

  return {
    emails,
    setEmails,
    isComposing,
    isSending,
    compose,
    send,
    sendAll,
  }
}
