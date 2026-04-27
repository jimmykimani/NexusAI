export type MatchStatus = 'fully_matched' | 'partially_matched'
export type FeedbackRating = 'positive' | 'negative'

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
  faithfulness_score?: number | null
  faithfulness_status?: 'verified' | 'needs_review' | string | null
  unverified_fields?: string[]

  outreach_sent: boolean
  is_saved: boolean
  created_at: string
  /** Which user search message produced this row (multi-search sessions). */
  source_query?: string | null
}

export type SessionStatus = 'pending' | 'searching' | 'complete' | 'error' | 'chat'

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
  thread_id?: string | null
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  created_at: string
}

export interface ConversationTurn {
  id: string
  thread_id: string
  session_id: string
  user_message: string
  assistant_summary: string | null
  status: SessionStatus | string
  result_lead_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  events?: StreamEvent[]
  created_at: string
  updated_at: string
}

export interface ConversationThread {
  id: string
  title: string | null
  latest_session_id: string | null
  latest_user_message: string | null
  latest_assistant_summary: string | null
  turn_count: number
  total_tokens: number
  created_at: string
  updated_at: string
}

export interface ConversationThreadDetail extends ConversationThread {
  turns: ConversationTurn[]
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
  client_received_at?: number
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
  to_email?: string | null
  subject: string
  body: string
}

export interface ComposeResponse {
  emails: ComposedEmail[]
}

export interface SendResponse {
  status: string
  message_id: string
  recipient_email: string
}

/** POST /search — either a real session + SSE, or an inline chat reply (no DB row). */
export type StartSearchResponse =
  | {
      mode: 'search'
      session_id: string
      status: SessionStatus
      message: string
    }
  | {
      mode: 'conversation'
      reply: string
    }

export interface SentEmail {
  id: string
  lead_id: string | null
  recipient_email: string
  recipient_name: string | null
  subject: string
  body: string
  status: string
  message_id: string
  created_at: string
}

export interface AgentLog {
  id: string
  session_id: string | null
  user_id: string | null
  stage: string
  event_type: string
  status: string
  pipeline_mode: 'nexus' | 'basic' | string
  prompt_version: string
  message: string | null
  payload?: Record<string, unknown> | null
  latency_ms?: number | null
  created_at: string
}

export interface EvalRun {
  id: string
  status: string
  dataset_size: number
  mrr: number
  precision_at_5: number
  recall_at_10: number
  summary?: Record<string, unknown> | null
  created_at: string
}

export interface MetricsSummary {
  health: {
    api: string
    database: string
    environment: string
    llm_provider: string
    prompt_version: string
  }
  summary: {
    searches_run: number
    completed_searches: number
    success_rate: number
    total_leads: number
    agent_logs: number
    helpful_feedback: number
    not_helpful_feedback: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  latency: {
    avg_ms: number | null
    p95_ms: number | null
  }
  pipeline_modes: {
    nexus: number
    basic: number
  }
  latest_eval: EvalRun | null
  recent_logs: AgentLog[]
}

export interface AdminLogsResponse {
  logs: AgentLog[]
}
