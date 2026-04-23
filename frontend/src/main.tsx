import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true'

if (!PUBLISHABLE_KEY && !AUTH_DISABLED) {
  console.warn(
    '[NexusAI] VITE_CLERK_PUBLISHABLE_KEY is not set. Either add a key or set VITE_DISABLE_AUTH=true.',
  )
}

/**
 * Clerk's modal is mounted once at provider init, so it cannot reactively swap
 * themes when the user toggles. Read the initial theme from the DOM (set
 * pre-render by the inline script in index.html) and pick matching colors; the
 * modal will adopt the current mode for the session.
 */
function getInitialClerkAppearance() {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  return isDark
    ? {
        variables: {
          colorPrimary: '#22c55e',
          colorBackground: '#13161c',
          colorInputBackground: '#191d25',
          colorInputText: '#e7eaef',
          colorText: '#e7eaef',
          colorTextSecondary: '#9aa4b3',
          colorNeutral: '#ffffff',
          borderRadius: '0.5rem',
        },
      }
    : {
        variables: {
          colorPrimary: '#16a34a',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#111827',
          colorText: '#111827',
          colorTextSecondary: '#4b5563',
          colorNeutral: '#111827',
          borderRadius: '0.5rem',
        },
      }
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (AUTH_DISABLED || !PUBLISHABLE_KEY) {
  // Run without Clerk; the backend DISABLE_AUTH flag provides the dev user.
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={getInitialClerkAppearance()}>
        <App />
      </ClerkProvider>
    </React.StrictMode>,
  )
}
