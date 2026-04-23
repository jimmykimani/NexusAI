import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/cn'

/** Tiny bottom-right toast stack. */
export function Toaster() {
  const toast = useUIStore((s) => s.toast)
  const dismiss = useUIStore((s) => s.dismissToast)
  if (!toast) return null

  const Icon =
    toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertTriangle : Info
  const tint =
    toast.type === 'success'
      ? 'border-emerald-500/40 text-emerald-300'
      : toast.type === 'error'
      ? 'border-red-500/40 text-red-300'
      : 'border-nexus-border text-nexus-muted'

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <div className={cn('card flex items-center gap-3 px-4 py-3 max-w-sm', tint)}>
        <Icon className="w-4 h-4 shrink-0" />
        <p className="text-sm text-nexus-text flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={dismiss}
          className="text-nexus-muted hover:text-nexus-text"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
