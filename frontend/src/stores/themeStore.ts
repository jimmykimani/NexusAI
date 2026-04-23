import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'nexusai-theme'

/** Read the current theme from the DOM (set pre-React by a script in index.html). */
function initialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore private-mode quota errors
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

/**
 * Tracks the active theme and mirrors it to the <html> element. The initial
 * value is read from the class already set by the pre-render script in
 * index.html, which honours localStorage first and the OS preference second.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
