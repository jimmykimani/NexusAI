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

function replaceSessionTurns(
  turns: ConversationTurn[],
  sessionId: string,
  nextTurns: ConversationTurn[],
): ConversationTurn[] {
  const rest = turns.filter((t) => t.session_id !== sessionId)
  return [...rest, ...nextTurns]
}

function updateLatestSessionTurn(
  turns: ConversationTurn[],
  sessionId: string,
  updater: (turn: ConversationTurn) => ConversationTurn,
): ConversationTurn[] {
  const next = [...turns]
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i].session_id === sessionId) {
      next[i] = updater(next[i])
      return next
    }
  }
  return turns
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

type PersistedTurnSnapshot = {
  query: string
  assistant_summary: string | null
  status: string
  lead_count: number
  created_at: string | null
  updated_at: string | null
}

function parsePersistedTurnHistory(criteria: SearchSession['criteria']): PersistedTurnSnapshot[] {
  const raw = criteria && typeof criteria === 'object'
    ? (criteria as Record<string, unknown>).turn_history
    : null
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const item = entry as Record<string, unknown>
      const query = typeof item.query === 'string' ? item.query.trim() : ''
      if (!query) return null
      return {
        query,
        assistant_summary:
          typeof item.assistant_summary === 'string' && item.assistant_summary.trim().length > 0
            ? item.assistant_summary.trim()
            : null,
        status: typeof item.status === 'string' && item.status.trim().length > 0 ? item.status : 'complete',
        lead_count:
          typeof item.lead_count === 'number'
            ? item.lead_count
            : Number.parseInt(String(item.lead_count ?? 0), 10) || 0,
        created_at: typeof item.created_at === 'string' ? item.created_at : null,
        updated_at: typeof item.updated_at === 'string' ? item.updated_at : null,
      }
    })
    .filter((entry): entry is PersistedTurnSnapshot => Boolean(entry))
}

function buildHydratedTurns(session: SearchSession): ConversationTurn[] {
  const history = parsePersistedTurnHistory(session.criteria)
  if (history.length > 0) {
    return history.map((entry, index) => ({
      id: `hydrated-${session.id}-${index}`,
      thread_id: session.thread_id ?? session.id,
      session_id: session.id,
      user_message: entry.query,
      assistant_summary: entry.assistant_summary,
      status: entry.status,
      result_lead_count: entry.lead_count,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      created_at: entry.created_at ?? session.created_at,
      updated_at: entry.updated_at ?? entry.created_at ?? session.created_at,
    }))
  }

  const criteriaRecord =
    session.criteria && typeof session.criteria === 'object'
      ? (session.criteria as Record<string, unknown>)
      : null
  const latestAssistantSummary =
    criteriaRecord && typeof criteriaRecord.latest_assistant_summary === 'string'
      ? criteriaRecord.latest_assistant_summary
      : null

  return [
    {
      id: `hydrated-${session.id}`,
      thread_id: session.thread_id ?? session.id,
      session_id: session.id,
      user_message: session.original_query,
      assistant_summary: latestAssistantSummary,
      status: session.status,
      result_lead_count: session.lead_count,
      input_tokens: session.input_tokens ?? 0,
      output_tokens: session.output_tokens ?? 0,
      total_tokens: session.total_tokens ?? 0,
      created_at: session.created_at,
      updated_at: session.created_at,
    },
  ]
}

interface SearchState {
  sessions: SearchSession[]
  activeSessionId: string | null
  /** Stable id for client-only chat turns (no `/search` row, no SSE). */
  localChatSessionId: string | null
  activeThreadTurns: ConversationTurn[]

  activeResultQuery: string | null
  setActiveResultQuery: (query: string | null) => void

  pendingQuery: string | null
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
  /** Bumped on each search start so SSE reconnects for follow-ups in the same session. */
  sseStreamEpoch: number

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
  appendThreadTurnSummaryChunk: (sessionId: string, chunk: string) => void
  toggleLeadSaved: (id: string, currentlySaved: boolean) => Promise<void>
  setThreadTurnResultCount: (sessionId: string, count: number) => void

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
  localChatSessionId: null,
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
  activeResultQuery: null,
  setActiveResultQuery: (q) => set({ activeResultQuery: q }),
  pendingQuery: null,
  sseStreamEpoch: 0,

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
      activeThreadTurns: updateLatestSessionTurn(state.activeThreadTurns, sessionId, (turn) => ({
        ...turn,
        status,
        updated_at: new Date().toISOString(),
      })),
    })),

  appendThreadTurnSummaryChunk: (sessionId, chunk) =>
    set((state) => ({
      activeThreadTurns: updateLatestSessionTurn(state.activeThreadTurns, sessionId, (turn) => ({
        ...turn,
        assistant_summary: `${turn.assistant_summary ?? ''}${chunk}`,
        updated_at: new Date().toISOString(),
      })),
    })),

  setThreadTurnResultCount: (sessionId, count) =>
    set((state) => ({
      activeThreadTurns: updateLatestSessionTurn(state.activeThreadTurns, sessionId, (turn) => ({
        ...turn,
        result_lead_count: count,
        updated_at: new Date().toISOString(),
      })),
    })),

  startSearch: async (query) => {
    const trimmed = query.trim()
    if (!trimmed || get().isSearching) return null
    const contIdRaw = get().activeSessionId
    const continueSessionId =
      contIdRaw && !contIdRaw.startsWith('local-') ? contIdRaw : undefined
    const isContinuing = Boolean(continueSessionId)
    set(() => ({
      isSearching: true,
      pendingQuery: trimmed,
      streamEvents: [],
      ...(isContinuing
        ? {}
        : {
            leads: [],
            fullyMatched: [],
            partiallyMatched: [],
          }),
      selectedLeadIds: new Set(),
      lastError: null,
      lastSearchElapsedMs: null,
      query,
      activeResultQuery: null,
    }))
    try {
      const { data } = await api.post<StartSearchResponse>('/search', {
        query: query.trim(),
        ...(continueSessionId ? { continue_session_id: continueSessionId } : {}),
      })
      if (data.mode === 'conversation') {
        const localId = get().localChatSessionId ?? `local-${crypto.randomUUID()}`
        const now = new Date().toISOString()
        const turn: ConversationTurn = {
          id: newTurnId(),
          thread_id: localId,
          session_id: localId,
          user_message: query.trim(),
          assistant_summary: data.reply,
          status: 'chat',
          result_lead_count: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          created_at: now,
          updated_at: now,
        }
        set((state) => ({
          isSearching: false,
          pendingQuery: null,
          streamLlmParams: null,
          localChatSessionId: localId,
          activeSessionId: localId,
          activeThreadTurns: [...state.activeThreadTurns, turn],
        }))
        return localId
      }
      const prof =
        CHAT_MODEL_PROFILES.find((p) => p.id === get().selectedChatModelId) ?? CHAT_MODEL_PROFILES[0]
      const turn = buildTurn(data.session_id, query.trim(), 'searching')
      const continued =
        Boolean(continueSessionId) && data.session_id === continueSessionId
      set((state) => ({
        activeSessionId: data.session_id,
        localChatSessionId: null,
        sseStreamEpoch: state.sseStreamEpoch + 1,
        streamLlmParams: {
          provider: prof.provider,
          reasoningModel: prof.reasoningModel,
          fastModel: prof.fastModel,
        },
        activeThreadTurns: continued
          ? [...state.activeThreadTurns, turn]
          : replaceOrAddTurn(state.activeThreadTurns, turn),
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
      const hydratedTurns = sess ? buildHydratedTurns(sess) : []
      set((state) => ({
        activeSessionId: sessionId,
        streamEvents: [],
        leads: [],
        selectedLeadIds: new Set(),
        activeThreadTurns: replaceSessionTurns(state.activeThreadTurns, sessionId, hydratedTurns),
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

  setActiveSession: (id) =>
    set({
      activeSessionId: id,
      activeResultQuery: null,
      query: '',
      pendingQuery: null,
      activeThreadTurns: [], // IMPORTANT: Clear current view while loading next
    }),

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
    set((state) => {
      const valid = new Set(withIds.map((l) => l.id))
      const selectedLeadIds = new Set(
        [...state.selectedLeadIds].filter((id) => valid.has(id)),
      )
      return { leads: withIds, fullyMatched: fully, partiallyMatched: partial, selectedLeadIds }
    })
  },

  refreshLeadsFromServer: async (sessionId) => {
    try {
      const { data } = await api.get<LeadsByStatus>('/leads', { params: { session_id: sessionId } })
      const all = [...data.fully_matched, ...data.partially_matched]
      set((state) => {
        const valid = new Set(all.map((l) => l.id))
        const selectedLeadIds = new Set(
          [...state.selectedLeadIds].filter((id) => valid.has(id)),
        )
        return {
          leads: all,
          fullyMatched: data.fully_matched,
          partiallyMatched: data.partially_matched,
          selectedLeadIds,
        }
      })
    } catch (err) {
      set({ lastError: apiErrorMessage(err) })
    }
  },

  setSearching: (v) =>
    set(() => ({
      isSearching: v,
      ...(v === false ? { pendingQuery: null, streamLlmParams: null } : {}),
    })),

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
      localChatSessionId: null,
      activeResultQuery: null,
      pendingQuery: null,
      query: '',
      lastError: null,
      lastSearchElapsedMs: null,
      sseStreamEpoch: 0,
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

  toggleLeadSaved: async (leadId, currentlySaved) => {
    const nextSaved = !currentlySaved
    // Optimistic update
    set((state) => {
      const updateLead = (l: Lead) => (l.id === leadId ? { ...l, is_saved: nextSaved } : l)
      return {
        leads: state.leads.map(updateLead),
        fullyMatched: state.fullyMatched.map(updateLead),
        partiallyMatched: state.partiallyMatched.map(updateLead),
      }
    })

    try {
      await api.patch(`/leads/${leadId}`, { is_saved: nextSaved })
    } catch {
      // Revert on error
      set((state) => {
        const revertLead = (l: Lead) => (l.id === leadId ? { ...l, is_saved: currentlySaved } : l)
        return {
          leads: state.leads.map(revertLead),
          fullyMatched: state.fullyMatched.map(revertLead),
          partiallyMatched: state.partiallyMatched.map(revertLead),
        }
      })
    }
  },
}))
