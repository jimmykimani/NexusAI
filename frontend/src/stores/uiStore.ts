import { create } from 'zustand'

export type AuxView = 'chat' | 'process' | 'emails' | 'mylist'

const CHAT_WIDTH_KEY = 'nexusai-chat-width'
const DEFAULT_CHAT_WIDTH = 400
const MIN_CHAT_WIDTH = 280
const MAX_CHAT_WIDTH = 720

function loadChatWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_CHAT_WIDTH
  const raw = window.localStorage.getItem(CHAT_WIDTH_KEY)
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(n)) return DEFAULT_CHAT_WIDTH
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, n))
}

interface UIState {
  sidebarCollapsed: boolean
  outreachModalOpen: boolean
  toast: { type: 'success' | 'error' | 'info'; message: string } | null
  auxView: AuxView
  profileLeadId: string | null
  chatWidth: number

  toggleSidebar: () => void
  openOutreach: () => void
  closeOutreach: () => void
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
  dismissToast: () => void
  setAuxView: (v: AuxView) => void
  openProfile: (leadId: string) => void
  closeProfile: () => void
  setChatWidth: (w: number) => void
}

export const CHAT_WIDTH_BOUNDS = { min: MIN_CHAT_WIDTH, max: MAX_CHAT_WIDTH }

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  outreachModalOpen: false,
  toast: null,
  auxView: 'chat',
  profileLeadId: null,
  chatWidth: loadChatWidth(),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openOutreach: () => set({ outreachModalOpen: true }),
  closeOutreach: () => set({ outreachModalOpen: false }),
  showToast: (type, message) => {
    set({ toast: { type, message } })
    setTimeout(() => {
      const current = useUIStore.getState().toast
      if (current && current.message === message) {
        set({ toast: null })
      }
    }, 3500)
  },
  dismissToast: () => set({ toast: null }),
  setAuxView: (v) => set({ auxView: v }),
  openProfile: (leadId) => set({ profileLeadId: leadId }),
  closeProfile: () => set({ profileLeadId: null }),
  setChatWidth: (w) => {
    const clamped = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, Math.round(w)))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHAT_WIDTH_KEY, String(clamped))
    }
    set({ chatWidth: clamped })
  },
}))
