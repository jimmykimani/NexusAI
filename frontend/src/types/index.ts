export type MatchStatus = 'fully_matched' | 'partially_matched'

export type StreamEventType =
  | 'plan'
  | 'searching'
  | 'found'
  | 'ranking'
  | 'complete'
  | 'error'
  /** Streamed assistant persona (intro before graph, outro after). */
  | 'persona_chunk'
  /** Emitted once at the end with `elapsed_ms` for total wall time. */
  | 'meta'
  /** Sentinel; handled in `useSSE` only — not stored in `streamEvents`. */
  | 'stream_end'

export interface ExperienceItem {
  company: string | null
  title: string | null
  start: string | null
  end: string | null
  summary?: string | null
}

export type PersonType =
  | 'creator'
  | 'influencer'
  | 'executive'
  | 'founder'
  | 'engineer'
  | 'designer'
  | 'investor'
  | 'researcher'
  | 'journalist'
  | 'talent'
  | 'academic'
  | 'other'

export interface Lead {
  id: string
  session_id: string
  name: string | null
  title: string | null
  headline?: string | null
  company: string | null
  location: string | null
  country_code?: string | null

  email: string | null

  linkedin_url: string | null
  github_url: string | null
  twitter_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  youtube_url?: string | null
  website_url?: string | null
  avatar_url?: string | null
  source_url?: string | null

  followers?: number | null
  person_type?: PersonType | null

  match_score: number
  match_status: MatchStatus
  matched_criteria: Record<string, boolean> | null

  bio: string | null
  ai_summary?: string | null
  skills: string[] | null
  experience?: ExperienceItem[] | null

  outreach_sent: boolean
  created_at: string
}

export type SessionStatus = 'pending' | 'searching' | 'complete' | 'error'

export interface SearchCriteria {
  roles?: string[]
  location?: string
  industry?: string
  seniority?: string
  keywords?: string[]
}

export interface SearchSession {
  id: string
  title: string | null
  original_query: string
  status: SessionStatus
  lead_count: number
  criteria?: SearchCriteria | null
  error?: string | null
  created_at: string
}

export interface StreamEventData {
  leads?: Lead[]
  criteria?: SearchCriteria
  queries?: string[]
  source_count?: number
  profile_count?: number
  /** `persona_chunk`: which narrative phase. */
  phase?: 'intro' | 'outro'
  /** `persona_chunk`: streamed text slice. */
  text?: string
  /** `meta`: wall-clock duration of the full run in ms. */
  elapsed_ms?: number
}

export interface StreamEvent {
  type: StreamEventType
  message: string
  data?: StreamEventData
}

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface LeadsByStatus {
  fully_matched: Lead[]
  partially_matched: Lead[]
}

export interface ComposedEmail {
  lead_id: string
  to_name: string | null
  subject: string
  body: string
}

export interface ComposeResponse {
  emails: ComposedEmail[]
}

export interface SendResponse {
  status: string
  message_id: string
}

export interface StartSearchResponse {
  session_id: string
  status: SessionStatus
  message: string
}
