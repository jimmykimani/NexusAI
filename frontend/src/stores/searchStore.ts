import { create } from 'zustand'
import { api, apiErrorMessage } from '@/api/client'
import type {
  Lead,
  LeadsByStatus,
  SearchSession,
  StartSearchResponse,
  StreamEvent,
} from '@/types'

interface SearchState {
  sessions: SearchSession[]
  activeSessionId: string | null

  query: string
  isSearching: boolean
  streamEvents: StreamEvent[]

  leads: Lead[]
  fullyMatched: Lead[]
  partiallyMatched: Lead[]

  selectedLeadIds: Set<string>
  lastError: string | null
  /** Total wall time for the last finished search (from SSE `meta`). */
  lastSearchElapsedMs: number | null

  setQuery: (q: string) => void
  startSearch: (query: string) => Promise<string | null>
  loadSessions: () => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  setActiveSession: (id: string | null) => void

  addStreamEvent: (event: StreamEvent) => void
  setSearchTiming: (elapsedMs: number | null) => void
  setLeads: (leads: Lead[]) => void
  refreshLeadsFromServer: (sessionId: string) => Promise<void>
  setSearching: (v: boolean) => void
  resetCurrent: () => void

  selectLead: (id: string) => void
  deselectLead: (id: string) => void
  toggleLead: (id: string) => void
  clearSelection: () => void
}

function partitionLeads(leads: Lead[]): { fully: Lead[]; partial: Lead[] } {
  const fully: Lead[] = []
  const partial: Lead[] = []
  for (const l of leads) {
    if (l.match_status === 'fully_matched') fully.push(l)
    else partial.push(l)
  }
  return { fully, partial }
}

export const useSearchStore = create<SearchState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  query: '',
  isSearching: false,
  streamEvents: [],
  leads: [],
  fullyMatched: [],
  partiallyMatched: [],
  selectedLeadIds: new Set(),
  lastError: null,
  lastSearchElapsedMs: null,

  setQuery: (q) => set({ query: q }),

  startSearch: async (query) => {
    if (!query.trim()) return null
    set({
      isSearching: true,
      streamEvents: [],
      leads: [],
      fullyMatched: [],
      partiallyMatched: [],
      selectedLeadIds: new Set(),
      lastError: null,
      lastSearchElapsedMs: null,
      query,
    })
    try {
      const { data } = await api.post<StartSearchResponse>('/search', { query })
      set({ activeSessionId: data.session_id })
      void get().loadSessions()
      return data.session_id
    } catch (err) {
      set({ isSearching: false, lastError: apiErrorMessage(err) })
      return null
    }
  },

  loadSessions: async () => {
    try {
      const { data } = await api.get<{ sessions: SearchSession[] }>('/search')
      set({ sessions: data.sessions })
    } catch (err) {
      set({ lastError: apiErrorMessage(err) })
    }
  },

  loadSession: async (sessionId) => {
    try {
      set({ activeSessionId: sessionId, streamEvents: [], leads: [] })
      const { data } = await api.get<LeadsByStatus>('/leads', { params: { session_id: sessionId } })
      const all = [...data.fully_matched, ...data.partially_matched]
      set({
        leads: all,
        fullyMatched: data.fully_matched,
        partiallyMatched: data.partially_matched,
        isSearching: false,
      })
    } catch (err) {
      set({ lastError: apiErrorMessage(err) })
    }
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  addStreamEvent: (event) =>
    set((state) => ({ streamEvents: [...state.streamEvents, event] })),

  setSearchTiming: (elapsedMs) => set({ lastSearchElapsedMs: elapsedMs }),

  setLeads: (leads) => {
    // Streamed leads from the agent pipeline arrive WITHOUT ids because the
    // backend only assigns UUIDs at DB persist time (after the stream closes).
    // We mint ephemeral client-side ids so rows are clickable immediately; the
    // next `/leads` refresh replaces them with canonical server ids.
    const withIds: Lead[] = leads.map((l) => {
      if (l.id) return l
      const ephemeral = (
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ephemeral-${Math.random().toString(36).slice(2)}-${Date.now()}`
      ) as string
      return { ...l, id: ephemeral }
    })
    const { fully, partial } = partitionLeads(withIds)
    set({ leads: withIds, fullyMatched: fully, partiallyMatched: partial })
  },

  refreshLeadsFromServer: async (sessionId) => {
    try {
      const { data } = await api.get<LeadsByStatus>('/leads', { params: { session_id: sessionId } })
      const all = [...data.fully_matched, ...data.partially_matched]
      set({
        leads: all,
        fullyMatched: data.fully_matched,
        partiallyMatched: data.partially_matched,
      })
    } catch (err) {
      set({ lastError: apiErrorMessage(err) })
    }
  },

  setSearching: (v) => set({ isSearching: v }),

  resetCurrent: () =>
    set({
      isSearching: false,
      streamEvents: [],
      leads: [],
      fullyMatched: [],
      partiallyMatched: [],
      selectedLeadIds: new Set(),
      activeSessionId: null,
      query: '',
      lastError: null,
      lastSearchElapsedMs: null,
    }),

  selectLead: (id) =>
    set((state) => {
      const next = new Set(state.selectedLeadIds)
      next.add(id)
      return { selectedLeadIds: next }
    }),
  deselectLead: (id) =>
    set((state) => {
      const next = new Set(state.selectedLeadIds)
      next.delete(id)
      return { selectedLeadIds: next }
    }),
  toggleLead: (id) =>
    set((state) => {
      const next = new Set(state.selectedLeadIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedLeadIds: next }
    }),
  clearSelection: () => set({ selectedLeadIds: new Set() }),
}))
