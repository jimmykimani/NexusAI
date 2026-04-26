import { create } from 'zustand'
import { api, apiErrorMessage } from '@/api/client'
import {
  CHAT_MODEL_PROFILES,
  initialChatModelId,
  writeStoredChatModelId,
  type ChatLlmProvider,
} from '@/config/chatModels'
import type {
  ConversationTurn,
  FeedbackRating,
  Lead,
  LeadsByStatus,
  SearchSession,
  StartSearchResponse,
  StreamEvent,
} from '@/types'

const LEAD_FEEDBACK_KEY = 'nexusai-lead-feedback'
const SESSION_FEEDBACK_KEY = 'nexusai-session-feedback'
const SESSION_TIMINGS_KEY = 'nexusai-session-timings'

function readFeedbackMap(storageKey: string): Record<string, FeedbackRating> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, FeedbackRating>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeFeedbackMap(storageKey: string, value: Record<string, FeedbackRating>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // ignore quota / private mode errors
  }
}

function readTimingMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SESSION_TIMINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeTimingMap(value: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_TIMINGS_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function replaceOrAddTurn(turns: ConversationTurn[], next: ConversationTurn): ConversationTurn[] {
  const rest = turns.filter((t) => t.session_id !== next.session_id)
  return [...rest, next]
}

function newTurnId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `turn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildTurn(sessionId: string, userMessage: string, status: ConversationTurn['status']): ConversationTurn {
  const now = new Date().toISOString()
  return {
    id: newTurnId(),
    thread_id: sessionId,
    session_id: sessionId,
    user_message: userMessage,
    assistant_summary: null,
    status,
    result_lead_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    created_at: now,
    updated_at: now,
  }
}

interface SearchState {
  sessions: SearchSession[]
  activeSessionId: string | null
  activeThreadTurns: ConversationTurn[]

  query: string
  isSearching: boolean
  streamEvents: StreamEvent[]

  leads: Lead[]
  fullyMatched: Lead[]
  partiallyMatched: Lead[]

  selectedLeadIds: Set<string>
  leadFeedback: Record<string, FeedbackRating>
  sessionFeedback: Record<string, FeedbackRating>
  sessionTimings: Record<string, number>
  lastError: string | null
  lastSearchElapsedMs: number | null

  streamLlmParams: {
    provider: ChatLlmProvider
    reasoningModel: string
    fastModel: string
  } | null
  selectedChatModelId: string
  setSelectedChatModelId: (id: string) => void
  setStreamLlmParams: (
    v: { provider: ChatLlmProvider; reasoningModel: string; fastModel: string } | null,
  ) => void

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
  patchThreadTurnStatus: (sessionId: string, status: ConversationTurn['status']) => void

  selectLead: (id: string) => void
  deselectLead: (id: string) => void
  toggleLead: (id: string) => void
  clearSelection: () => void
  submitLeadFeedback: (leadId: string, rating: FeedbackRating) => Promise<void>
  submitSessionFeedback: (sessionId: string, rating: FeedbackRating) => Promise<void>
  findMore: () => Promise<string | null>
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
  activeThreadTurns: [],
  query: '',
  isSearching: false,
  streamEvents: [],
  leads: [],
  fullyMatched: [],
  partiallyMatched: [],
  selectedLeadIds: new Set(),
  leadFeedback: readFeedbackMap(LEAD_FEEDBACK_KEY),
  sessionFeedback: readFeedbackMap(SESSION_FEEDBACK_KEY),
  sessionTimings: readTimingMap(),
  lastError: null,
  lastSearchElapsedMs: null,

  streamLlmParams: null,
  selectedChatModelId: initialChatModelId(),

  setSelectedChatModelId: (id) => {
    writeStoredChatModelId(id)
    set({ selectedChatModelId: id })
  },
  setStreamLlmParams: (v) => set({ streamLlmParams: v }),

  setQuery: (q) => set({ query: q }),

  patchThreadTurnStatus: (sessionId, status) =>
    set((state) => ({
      activeThreadTurns: state.activeThreadTurns.map((t) =>
        t.session_id === sessionId ? { ...t, status, updated_at: new Date().toISOString() } : t,
      ),
    })),

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
      const prof =
        CHAT_MODEL_PROFILES.find((p) => p.id === get().selectedChatModelId) ?? CHAT_MODEL_PROFILES[0]
      const turn = buildTurn(data.session_id, query.trim(), 'searching')
      set((state) => ({
        activeSessionId: data.session_id,
        streamLlmParams: {
          provider: prof.provider,
          reasoningModel: prof.reasoningModel,
          fastModel: prof.fastModel,
        },
        activeThreadTurns: replaceOrAddTurn(state.activeThreadTurns, turn),
      }))
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
      let sess = get().sessions.find((s) => s.id === sessionId)
      if (!sess) {
        await get().loadSessions()
        sess = get().sessions.find((s) => s.id === sessionId)
      }
      const hydratedTurn: ConversationTurn | null = sess
        ? {
            id: `hydrated-${sessionId}`,
            thread_id: sess.thread_id ?? sessionId,
            session_id: sessionId,
            user_message: sess.original_query,
            assistant_summary: null,
            status: sess.status,
            result_lead_count: sess.lead_count,
            input_tokens: sess.input_tokens ?? 0,
            output_tokens: sess.output_tokens ?? 0,
            total_tokens: sess.total_tokens ?? 0,
            created_at: sess.created_at,
            updated_at: sess.created_at,
          }
        : null
      set((state) => ({
        activeSessionId: sessionId,
        streamEvents: [],
        leads: [],
        selectedLeadIds: new Set(),
        activeThreadTurns: hydratedTurn
          ? replaceOrAddTurn(state.activeThreadTurns, hydratedTurn)
          : state.activeThreadTurns,
      }))
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
    set((state) => ({
      streamEvents: [...state.streamEvents, { ...event, client_received_at: Date.now() }],
    })),

  setSearchTiming: (elapsedMs) =>
    set((state) => {
      const activeSessionId = state.activeSessionId
      if (!activeSessionId || elapsedMs == null) {
        return { lastSearchElapsedMs: elapsedMs }
      }
      const nextTimings = { ...state.sessionTimings, [activeSessionId]: elapsedMs }
      writeTimingMap(nextTimings)
      return { lastSearchElapsedMs: elapsedMs, sessionTimings: nextTimings }
    }),

  setLeads: (leads) => {
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
      activeThreadTurns: [],
      activeSessionId: null,
      query: '',
      lastError: null,
      lastSearchElapsedMs: null,
      streamLlmParams: null,
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

  submitLeadFeedback: async (leadId, rating) => {
    try {
      await api.post(`/leads/${leadId}/feedback`, { rating })
    } catch {
      // optimistic UX when backend has no feedback route
    } finally {
      set((state) => {
        const next = { ...state.leadFeedback, [leadId]: rating }
        writeFeedbackMap(LEAD_FEEDBACK_KEY, next)
        return { leadFeedback: next }
      })
    }
  },

  submitSessionFeedback: async (sessionId, rating) => {
    try {
      await api.post(`/search/${sessionId}/feedback`, { rating })
    } catch {
      // optimistic UX
    } finally {
      set((state) => {
        const next = { ...state.sessionFeedback, [sessionId]: rating }
        writeFeedbackMap(SESSION_FEEDBACK_KEY, next)
        return { sessionFeedback: next }
      })
    }
  },

  findMore: async () => {
    const activeSessionId = get().activeSessionId
    const session = get().sessions.find((entry) => entry.id === activeSessionId)
    if (!session) {
      set({ lastError: 'Open a search session before asking for more results.' })
      return null
    }
    return get().startSearch(session.original_query)
  },
}))
