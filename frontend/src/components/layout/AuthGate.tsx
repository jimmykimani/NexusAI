import { useEffect, type ReactNode } from 'react'
import {
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import { setTokenProvider } from '@/api/client'
import { MarketingLanding } from '@/components/landing/MarketingLanding'
import { useAuthStore } from '@/stores/authStore'

const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true'

/**
 * Gates the app behind Clerk sign-in unless `VITE_DISABLE_AUTH=true`, in which
 * case the backend's dev-user bypass is used and no UI is shown.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (AUTH_DISABLED) return <>{children}</>
  return (
    <>
      <SignedOut>
        <MarketingLanding />
      </SignedOut>
      <SignedIn>
        <ClerkTokenBridge />
        {children}
      </SignedIn>
    </>
  )
}

/** Wires Clerk's async token retrieval into the axios client + SSE URL builder. */
function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth()
  const { user } = useUser()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    setTokenProvider(async () => {
      try {
        return (await getToken()) ?? null
      } catch {
        return null
      }
    })
  }, [getToken])

  useEffect(() => {
    if (isSignedIn && user) {
      setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        full_name:
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
      })
    } else {
      setUser(null)
    }
  }, [isSignedIn, user, setUser])

  return null
}
