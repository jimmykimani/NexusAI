import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CHAT_MODEL_PROFILES } from '@/config/chatModels'
import { useSearchStore } from '@/stores/searchStore'
import { cn } from '@/lib/cn'

export type ChatModelMenuPlacement = 'up' | 'down'

interface ChatModelPickerProps {
  disabled?: boolean
  /** Hero: `down` (Perplexity). Chat footer: `up` so the menu stays in view above the input. */
  menuPlacement?: ChatModelMenuPlacement
}

/** Compact model selector for chat / hero inputs (persists choice in localStorage). */
export function ChatModelPicker({ disabled, menuPlacement = 'down' }: ChatModelPickerProps) {
  const selectedId = useSearchStore((s) => s.selectedChatModelId)
  const setSelected = useSearchStore((s) => s.setSelectedChatModelId)
  const current = CHAT_MODEL_PROFILES.find((p) => p.id === selectedId) ?? CHAT_MODEL_PROFILES[0]
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'inline-flex max-w-[10.5rem] items-center gap-1 rounded-full border border-nexus-border',
          'bg-nexus-elevated/50 px-2.5 py-1 text-[11px] font-medium text-nexus-text/90 shadow-none',
          'hover:bg-nexus-elevated/60 transition-colors',
          disabled && 'opacity-45 cursor-not-allowed',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model: ${current.pill}. Open menu.`}
      >
        <span className="truncate">{current.pill}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-nexus-muted" aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose model"
          className={cn(
            'absolute right-0 z-[60] w-[min(17rem,calc(100vw-2rem))] card p-0 overflow-hidden shadow-none',
            menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          <p className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-nexus-muted border-b border-nexus-border bg-nexus-bg">
            Next search
          </p>
          <ul className="divide-y divide-nexus-border/70 bg-nexus-card overflow-hidden">
            {CHAT_MODEL_PROFILES.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === selectedId}
                  className={cn(
                    'group w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors',
                    'hover:bg-nexus-elevated/60 focus-visible:outline-none focus-visible:bg-nexus-elevated/60',
                    p.id === selectedId
                      ? 'bg-nexus-accent/10 hover:bg-nexus-accent/15'
                      : 'bg-nexus-card',
                  )}
                  onClick={() => {
                    setSelected(p.id)
                    setOpen(false)
                  }}
                >
                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'block text-[13px] font-medium leading-tight transition-colors',
                        p.id === selectedId
                          ? 'text-nexus-text'
                          : 'text-nexus-text group-hover:text-nexus-accent',
                      )}
                    >
                      {p.pill}
                    </span>
                    <span className="block text-[11px] text-nexus-muted leading-snug mt-0.5">
                      {p.description}
                    </span>
                  </span>
                  {p.id === selectedId ? (
                    <Check className="w-3.5 h-3.5 text-nexus-accent shrink-0 mt-0.5" aria-hidden />
                  ) : (
                    <span className="w-3.5 shrink-0" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
