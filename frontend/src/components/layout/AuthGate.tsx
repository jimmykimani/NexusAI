import { useEffect, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import { setTokenProvider } from '@/api/client'
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
        <LandingCard />
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

function LandingCard() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-nexus-bg relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[360px] pointer-events-none
                   bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.12),transparent_65%)]"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-nexus-card/80 border border-nexus-border p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6 text-nexus-accent" />
          <div>
            <h1 className="text-xl font-semibold leading-tight">NexusAI</h1>
            <p className="text-sm text-nexus-muted">Your people search AI agent</p>
          </div>
        </div>

        <h2 className="text-3xl font-semibold leading-[1.15] mb-3">
          Find <span className="serif-italic text-nexus-accent">anyone</span>.
          <br />
          Write to <span className="serif-italic">everyone</span>.
        </h2>
        <p className="text-sm text-nexus-subtle mb-8">
          Describe who you&rsquo;re looking for in plain English. Our agents scan
          LinkedIn, GitHub, personal sites and more, then rank by match score.
        </p>

        <div className="flex flex-col gap-2.5">
          <SignInButton mode="modal">
            <button className="w-full btn-primary py-2.5 text-sm">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="w-full btn-primary-dark py-2.5 text-sm">
              Create account
            </button>
          </SignUpButton>
        </div>

        <p className="mt-6 text-[11px] text-nexus-muted text-center">
          Auth by Clerk. No credit card required.
        </p>
      </div>
    </div>
  )
}
