import { useEffect } from 'react'
import { AuthGate } from '@/components/layout/AuthGate'
import { Layout } from '@/components/layout/Layout'
import { ProfilePanel } from '@/components/profile/ProfilePanel'
import { Toaster } from '@/components/ui/Toaster'
import { useSearchStore } from '@/stores/searchStore'
import { useAuthStore } from '@/stores/authStore'

const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true'

export default function App() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const loadSessions = useSearchStore((s) => s.loadSessions)

  useEffect(() => {
    if (AUTH_DISABLED || isSignedIn) {
      void loadSessions()
    }
  }, [isSignedIn, loadSessions])

  return (
    <AuthGate>
      <Layout />
      <ProfilePanel />
      <Toaster />
    </AuthGate>
  )
}
