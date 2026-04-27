# NexusAI — System Architecture

## Overview

NexusAI is an AI-powered people search and outreach platform.
Users describe a target person in plain English. The system searches
multiple sources in parallel, scores results deterministically,
and generates personalised outreach emails.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Zustand + Vite | SPA with real-time SSE rendering |
| Backend | Python 3.12 + FastAPI + LangGraph | Agent orchestration, REST API, SSE streaming |
| Database | PostgreSQL (RDS) / SQLite (dev) | Users, sessions, leads, metrics |
| Vector Store | ChromaDB (local) | Semantic cache, past search dedup |
| LLM Primary | Groq (llama-3.1-8b) | Planning, extraction, routing (free tier) |
| LLM Quality | Claude Sonnet (Anthropic) | Email composition (pay-per-use) |
| Search | Tavily + Serper + GitHub API | Multi-source web + API search |
| Auth | Clerk (JWKS) + Legacy JWT | Dual-mode authentication |
| Observability | LangSmith + Structured JSON logs | Tracing, metrics, alerts |
| CI/CD | GitHub Actions → AWS ECR → ECS | Automated test, build, deploy |

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Zustand + Vite)                                │
│                                                                   │
│  POST /api/v1/search         → creates session, returns id       │
│  GET  /api/v1/search/{id}/stream → SSE: plan/searching/found/... │
│  GET  /api/v1/leads          → paginated lead results             │
│  POST /api/v1/outreach/compose → email drafts (Claude Sonnet)    │
│  GET  /api/v1/metrics        → system health, token usage, eval  │
│  GET  /api/v1/health         → prompt versions, git hash, cache  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┴──────────────────────────────────────┐
│  FastAPI Backend (ECS Fargate / local uvicorn, port 8000)        │
│                                                                   │
│  ┌─ Auth ────────────────────────────────────────────────────┐   │
│  │  Clerk JWKS verification + Legacy HS256 JWT fallback      │   │
│  │  Rate limiting: slowapi (configurable per endpoint)       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ LangGraph Pipeline (StateGraph) ─────────────────────────┐   │
│  │                                                            │   │
│  │  [guardrail]  → regex + PII input check                   │   │
│  │       ↓                                                    │   │
│  │  [supervisor] → query → structured criteria (Groq 8B)     │   │
│  │       ↓                                                    │   │
│  │  [search]     → parallel: Tavily + Serper + GitHub         │   │
│  │       ↓                                                    │   │
│  │  [ranking]    → deterministic scorer (zero LLM calls)      │   │
│  │       ↓                                                    │   │
│  │  [research]   → enrichment pass                            │   │
│  │       ↓                                                    │   │
│  │  [evaluate]   → quality check → retry loop if < threshold  │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ LLM Gateway ────────────────────────────────────────────┐    │
│  │  Fallback chain: Groq 8B → Groq 70B → OpenRouter → OpenAI│    │
│  │  Rate-limit backoff, call counting, cost tracking          │    │
│  │  Per-request model override via ContextVar                 │    │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│  Data Layer                                                       │
│                                                                   │
│  PostgreSQL (RDS / SQLite dev)                                    │
│  ├── users            — id, email, clerk_user_id, created_at      │
│  ├── search_sessions  — id, user_id, query, criteria, status      │
│  ├── leads            — id, session_id, name, title, match_score  │
│  └── agent_metrics    — id, session_id, provider, model, tokens   │
│                                                                   │
│  ChromaDB (local PersistentClient)                                │
│  └── semantic_cache   — past search embeddings for dedup          │
│                                                                   │
│  In-memory TTL Cache                                              │
│  ├── tavily:*         — web results (72h TTL)                     │
│  ├── criteria:*       — supervisor output (4h TTL)                │
│  └── search_results:* — lead sets (6h TTL)                        │
└─────────────────────────────────────────────────────────────────┘

External Services:
  ├── Groq API          — llama-3.1-8b (supervisor, extraction)
  ├── Anthropic API     — claude-sonnet (email only)
  ├── Tavily API        — web search (primary)
  ├── Serper API        — Google search (secondary)
  ├── GitHub API        — developer profiles (free, 5k/hour)
  ├── Apollo.io API     — professional profiles
  └── LangSmith         — LLM tracing, evaluation, annotation
```

## Request Flow (Search)

1. **User submits query** from frontend search input
2. **POST /search**: Intent classifier determines search vs conversation
3. Creates `SearchSession` + returns `session_id`
4. **Frontend opens SSE stream**: `GET /search/{id}/stream`
5. **Guardrail middleware**: regex check for prompt injection attempts
6. **Supervisor node**: Groq 8B → structured `SearchCriteria` (Pydantic-validated JSON)
7. **Search node**: parallel queries to Tavily + Serper + GitHub (source count based on complexity)
8. **LLM extraction**: raw web content → structured profiles via extraction prompt
9. **Ranking node**: deterministic `score_profile()` → sort → split fully/partially matched
10. **Research node**: optional enrichment pass
11. **Evaluate node**: quality gate — if < 3 leads and retries remaining, loop back to supervisor with broader criteria
12. **Stream complete event** with scored leads → frontend updates results table
13. **Background**: leads persisted to DB, metrics logged, semantic cache updated

## Data Model

### Core Tables

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `users` | id, email, clerk_user_id, is_active | Platform users |
| `search_sessions` | id, user_id, query, criteria (JSON), status, lead_count | One per search |
| `leads` | id, session_id, name, title, company, match_score, match_status | Scored results |
| `agent_metrics` | id, session_id, provider, model, prompt_tokens, completion_tokens, latency_ms | LLM usage tracking |

### Key Relationships

- `User` 1:N `SearchSession` (cascade delete)
- `SearchSession` 1:N `Lead` (cascade delete)
- `SearchSession` 1:N `AgentMetric` (set null on delete)

## Scoring Algorithm

The deterministic scorer (`services/ranking.py`) assigns points across 6 dimensions:

| Dimension | Weight | Logic |
|-----------|--------|-------|
| Role match | 35 | Target role keywords found in title/headline |
| Location | 25 | Target city found in profile location |
| Keywords | 20 | Partial credit: (hits / total) × 20 |
| Contactable | 10 | Has email, LinkedIn, or GitHub URL |
| Seniority | 5 | Seniority keywords match target band |
| Completeness | 5 | Has title + company + bio/headline |

**Threshold:** score ≥ 70 → `fully_matched`, else `partially_matched`.

## Security

- **Auth**: Clerk JWKS (RS256) with legacy JWT (HS256) fallback
- **Input validation**: Pydantic schemas on all endpoints
- **Prompt injection**: Middleware blocks known injection phrases
- **PII masking**: Guardrail strips SSN/phone patterns from LLM output
- **CORS**: Configurable origin whitelist
- **Secrets**: All API keys via environment variables (AWS Secrets Manager in production)

## Deployment

| Component | Service | Configuration |
|-----------|---------|--------------|
| Frontend | AWS Amplify | Auto-deploy from GitHub, PR previews |
| Backend | AWS ECS Fargate | Docker container, auto-scaling |
| Database | AWS RDS PostgreSQL | Multi-AZ, automated backups |
| Secrets | AWS Secrets Manager | All API keys centralized |
| CDN | AWS CloudFront | In front of Amplify for edge caching |
| DNS + SSL | Route 53 + ACM | Custom domain with auto-renewed certs |
| Logs | CloudWatch Logs | Structured JSON, queryable |
| Alerts | CloudWatch Alarms → SNS | Error rate, latency p95, cost spikes |
