import { useCallback } from 'react'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Wraps `searchStore.startSearch` with UI niceties: validation + toasts.
 */
export function useSearch() {
  const startSearch = useSearchStore((s) => s.startSearch)
  const setQuery = useSearchStore((s) => s.setQuery)
  const query = useSearchStore((s) => s.query)
  const isSearching = useSearchStore((s) => s.isSearching)
  const showToast = useUIStore((s) => s.showToast)

  const submit = useCallback(
    async (override?: string) => {
      const q = (override ?? query).trim()
      if (!q.length) {
        showToast('error', 'Please enter a message first.')
        return null
      }
      // Optimistically clear the textbox to remove lag feeling
      setQuery('')
      
      const sessionId = await startSearch(q)
      if (!sessionId) {
        // Restore query on failure
        setQuery(q)
        showToast(
          'error',
          useSearchStore.getState().lastError || 'Message could not be sent. Check your connection.',
        )
      }
      return sessionId
    },
    [query, startSearch, showToast, setQuery],
  )

  return { query, setQuery, isSearching, submit }
}
