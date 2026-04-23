import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/cn'

interface Props {
  className?: string
  variant?: 'icon' | 'labeled'
}

/** Light/dark theme switch. Persists to localStorage via the theme store. */
export function ThemeToggle({ className, variant = 'icon' }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs',
          'text-nexus-subtle hover:text-nexus-text',
          'border border-nexus-border bg-nexus-card hover:bg-nexus-elevated transition-colors',
          className,
        )}
      >
        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-md',
        'text-nexus-subtle hover:text-nexus-text hover:bg-nexus-elevated',
        'border border-transparent hover:border-nexus-border transition-colors',
        className,
      )}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
