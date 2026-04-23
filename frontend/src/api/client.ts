import axios, { AxiosError } from 'axios'

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) || ''

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
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Unknown error'
}

export async function buildSseUrl(sessionId: string): Promise<string> {
  const token = (await getAuthToken()) ?? ''
  const root = baseURL || ''
  return `${root}/api/v1/search/${sessionId}/stream?token=${encodeURIComponent(token)}`
}
