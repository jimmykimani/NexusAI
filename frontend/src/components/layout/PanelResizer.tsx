import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CHAT_WIDTH_BOUNDS, useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/cn'

/**
 * Thin drag handle between the chat column and the results column.
 * Shows twin left/right chevrons so the affordance is obvious, mirrors
 * Lessie's layout behavior. Double-click to reset to default.
 */
export function PanelResizer() {
  const chatWidth = useUIStore((s) => s.chatWidth)
  const setChatWidth = useUIStore((s) => s.setChatWidth)
  const startXRef = useRef(0)
  const startWRef = useRef(chatWidth)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startXRef.current = e.clientX
      startWRef.current = chatWidth
      setDragging(true)
    },
    [chatWidth],
  )

  useEffect(() => {
    if (!dragging) return

    function onMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current
      setChatWidth(startWRef.current + delta)
    }
    function onUp() {
      setDragging(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, setChatWidth])

  function onDoubleClick() {
    setChatWidth(400)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setChatWidth(chatWidth - (e.shiftKey ? 48 : 16))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setChatWidth(chatWidth + (e.shiftKey ? 48 : 16))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={CHAT_WIDTH_BOUNDS.min}
      aria-valuemax={CHAT_WIDTH_BOUNDS.max}
      aria-valuenow={chatWidth}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative w-2 shrink-0 cursor-col-resize select-none',
        'bg-nexus-border/50 hover:bg-nexus-accent/35 transition-colors',
        dragging && 'bg-nexus-accent/55',
        'focus:outline-none focus-visible:bg-nexus-accent/55',
      )}
      title="Drag to resize — double-click to reset"
    >
      {/* Enlarged hit target so the user doesn't need surgical precision */}
      <span className="absolute inset-y-0 -left-3 -right-3" />

      {/* Visible chevron grip */}
      <span
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'flex items-center gap-0.5 rounded-full px-1.5 py-1',
          'bg-nexus-card border border-nexus-border shadow-sm',
          'opacity-70 group-hover:opacity-100 transition-opacity',
          dragging && 'opacity-100',
        )}
      >
        <ChevronLeft className="w-3 h-3 text-nexus-subtle" />
        <ChevronRight className="w-3 h-3 text-nexus-subtle" />
      </span>
    </div>
  )
}
