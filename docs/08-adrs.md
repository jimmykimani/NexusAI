# 08 · Architecture Decision Records

## ADR-001: LangGraph over CrewAI
**Decision:** LangGraph for agent orchestration.
**Reasoning:** Explicit state transitions, checkpointing, first-class streaming.
**Trade-off:** More boilerplate than CrewAI; worth it for debuggability.

## ADR-002: SSE over WebSockets
**Decision:** Server-Sent Events for progress streaming.
**Reasoning:** Unidirectional, works over HTTP/1.1, browser auto-reconnect, no upgrade handshake.
**Trade-off:** Client can't send mid-stream messages — not needed here.

## ADR-003: ChromaDB for dev
**Decision:** ChromaDB locally instead of Pinecone.
**Reasoning:** Zero infrastructure for a capstone scope.
**Trade-off:** Not production-scalable; swap to Pinecone for scale.

## ADR-004: Haiku for scoring, Sonnet for reasoning
**Decision:** Split LLM usage by task.
**Reasoning:** Scoring is a classification task — Haiku at ~1/20 cost. Sonnet for decomposition + outreach.
**Trade-off:** Two models to manage; ~70% cost reduction per search.

## ADR-005: PostgreSQL JSONB for lead data
**Decision:** Store enriched lead metadata in JSONB.
**Reasoning:** Profile shape is unpredictable; JSONB keeps flexibility while searchable.
**Trade-off:** Harder to query ad-hoc JSONB fields — acceptable for current patterns.

## ADR-006: Tavily over SerpAPI
**Decision:** Tavily as primary search.
**Reasoning:** Purpose-built for LLM consumption; cleaner structured output.
**Trade-off:** Lower volume than SerpAPI. SerpAPI stays as a fallback.

## ADR-007: Stateless JWT auth
**Decision:** JWT with no server-side sessions.
**Reasoning:** No Redis in stack; simplest thing that works.
**Trade-off:** Can't revoke mid-token-life — mitigated by 24h expiry.

## ADR-008: Three-panel fixed-width layout
**Decision:** Sidebar 240px, Chat 420px, Results flex-1.
**Reasoning:** Mirrors the Lessie-AI demo, prevents layout shift during streaming.
**Trade-off:** Not mobile-responsive — desktop-only demo.
