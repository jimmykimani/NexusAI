import { ArrowUp, Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  /** `compact` trims vertical padding for the in-chat footer input. */
  compact?: boolean
  /** Draws a pulsing accent glow around the box (e.g. while searching). */
  glowing?: boolean
}

/** Multiline textarea + submit button; Enter submits, Shift+Enter = newline. */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Describe who you're looking for…",
  compact,
  glowing,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [value])

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit()
    }
  }

  return (
    <div
      className={cn(
        'card p-3 transition-shadow',
        compact && 'p-2.5',
        glowing && 'animate-search-glow border-nexus-accent/40',
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none bg-transparent border-0 focus:outline-none focus:ring-0 text-sm placeholder:text-nexus-muted leading-relaxed"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-nexus-muted inline-flex items-center gap-1">
          <Plus className="w-3 h-3" />
          {disabled ? 'Running…' : 'Attach context (soon)'}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="btn-primary w-8 h-8 p-0 rounded-full"
          aria-label="Send"
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
