import { useEffect } from 'react'
import { AuthGate } from '@/components/layout/AuthGate'
import { Layout } from '@/components/layout/Layout'
import { ProfilePanel } from '@/components/profile/ProfilePanel'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { Toaster } from '@/components/ui/Toaster'
import { useSearchStore } from '@/stores/searchStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true'

export default function App() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn)
  const loadSessions = useSearchStore((s) => s.loadSessions)
  const selectedLeadIds = useSearchStore((s) => s.selectedLeadIds)
  const openOutreach = useUIStore((s) => s.openOutreach)
  const closeOutreach = useUIStore((s) => s.closeOutreach)
  const closeProfile = useUIStore((s) => s.closeProfile)
  const closeSettings = useUIStore((s) => s.closeSettings)

  useEffect(() => {
    if (AUTH_DISABLED || isSignedIn) {
      void loadSessions()
    }
  }, [isSignedIn, loadSessions])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('nexusai:focus-search'))
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
        if (selectedLeadIds.size > 0) {
          event.preventDefault()
          openOutreach()
        }
      }
      if (event.key === 'Escape') {
        closeOutreach()
        closeProfile()
        closeSettings()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [closeOutreach, closeProfile, closeSettings, openOutreach, selectedLeadIds])

  return (
    <AuthGate>
      <Layout />
      <ProfilePanel />
      <SettingsModal />
      <Toaster />
    </AuthGate>
  )
}
