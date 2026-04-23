import { create } from 'zustand'
import type { AuthUser } from '@/types'

/**
 * A lean auth store for Clerk integration.
 *
 * Session lifetime, token refresh, and sign-out are owned by Clerk. This store
 * just mirrors the essentials (`user`, `isSignedIn`) so any component can
 * subscribe without pulling Clerk hooks in.
 */
interface AuthState {
  user: AuthUser | null
  isSignedIn: boolean
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isSignedIn: false,
  setUser: (user) => set({ user, isSignedIn: Boolean(user) }),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('nexusai:logout', () => {
    useAuthStore.getState().setUser(null)
  })
}
