import axios, { AxiosError } from 'axios'

/**
 * In dev, prefer same-origin `/api/v1` so Vite proxies to FastAPI (see `vite.config.ts`).
 * If `VITE_API_URL` points at loopback:8000, browsers often bypass the proxy and hit the
 * wrong interface (or nothing) — force proxy by returning ''.
 */
function resolveApiBaseUrl(): string {
  // Use the ALB URL as a hardcoded fallback for the production demo
  const fallback = 'http://nexusai-alb-398865142.us-east-1.elb.amazonaws.com'
  const raw = (
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined)
  )?.trim() ?? ''
  
  if (!import.meta.env.DEV) return raw || fallback
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    const loopback = h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
    // Same-machine API on 8000: use Vite `/api` proxy (avoids IPv4/IPv6 localhost mismatches).
    if (loopback && u.port === '8000') return ''
  } catch {
    return raw
  }
  return raw
}

const baseURL = resolveApiBaseUrl()

export const api = axios.create({
  baseURL: `${baseURL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * A pluggable token provider so the axios client can stay decoupled from the
 * auth implementation. In Clerk mode, `ClerkTokenBridge` registers a callback
 * here that calls `getToken()`. When auth is disabled the provider returns null.
 */
type TokenGetter = () => Promise<string | null>
let tokenProvider: TokenGetter = async () => null

export function setTokenProvider(fn: TokenGetter): void {
  tokenProvider = fn
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await tokenProvider()
  } catch {
    return null
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('nexusai:logout'))
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: string | Array<{ msg?: string }> } | undefined
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      const first = data.detail[0]
      if (first && typeof first === 'object' && 'msg' in first && first.msg) return String(first.msg)
    }
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      return (
        'Cannot reach API. Start the backend (e.g. port 8000), set VITE_API_URL if not using the Vite ' +
        'proxy, or set VITE_DEV_PROXY_TARGET for dockerized APIs.'
      )
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Unknown error'
}

export async function buildSseUrl(sessionId: string, llmQuerySuffix?: string): Promise<string> {
  const token = (await getAuthToken()) ?? ''
  const root = baseURL || ''
  let url = `${root}/api/v1/search/${sessionId}/stream?token=${encodeURIComponent(token)}`
  if (llmQuerySuffix) {
    url += llmQuerySuffix.startsWith('&') ? llmQuerySuffix : `&${llmQuerySuffix}`
  }
  return url
}
