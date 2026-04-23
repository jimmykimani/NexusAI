# 01 · System Overview

## What It Is
NexusAI is an AI-powered people search and personalized outreach platform. Users describe a target person in plain English; the system finds real matches across the web, scores them for relevance, and composes personalized outreach emails.

**Value prop:** Replace hours of manual LinkedIn searching and cold email writing with a 30-second AI-driven workflow.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + TailwindCSS | Type-safe, fast, great DX |
| State | Zustand | Lightweight, no boilerplate |
| Streaming | Server-Sent Events (SSE) | Simple, no WebSocket infra needed |
| Backend | FastAPI (Python 3.11) | Async-native, auto OpenAPI docs |
| Agents | LangGraph | Fine-grained state machine control |
| Primary LLM | `claude-sonnet-4-5` | Best reasoning + instruction following |
| Fast LLM | `claude-haiku-4-5` | Scoring tasks, cheap + fast |
| Search | Tavily API | Purpose-built AI web search |
| Embeddings | OpenAI `text-embedding-3-small` | Simple, reliable for dev |
| Vectors | ChromaDB (local) | Zero infrastructure for dev/capstone |
| Database | PostgreSQL 15 | Reliable; JSONB for flexible lead data |
| Auth | JWT (python-jose) | Stateless, simple |
| Infra | Docker Compose | Single command dev setup |

## Services

```
nexusai-backend     FastAPI app, port 8000
nexusai-frontend    React SPA, port 5173
nexusai-postgres    PostgreSQL, port 5432
nexusai-nginx       Reverse proxy, port 80 (prod only)
```

## High-level Flow

1. User types a natural-language search request.
2. **Supervisor agent** decomposes it into structured criteria and Tavily query strings.
3. **Search agent** fans out to Tavily, extracts structured profiles via Claude.
4. **Ranking agent** scores each profile 0–100 with Claude Haiku.
5. Stream events push progress to the browser via SSE; results land in a live table.
6. User selects leads; **outreach agent** drafts personalized emails (Claude Sonnet).
