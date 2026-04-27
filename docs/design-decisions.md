# NexusAI — Architecture Decision Records

All architectural decisions are documented using the ADR format.
Each record captures the context, decision, reasoning, and trade-offs.

---

## ADR-001: LangGraph over CrewAI for Agent Orchestration

**Date:** 2025-04-01
**Status:** Accepted

**Context:** Needed a multi-step agent pipeline with streaming, branching, and error recovery for the people search workflow.

**Decision:** LangGraph (StateGraph) for agent orchestration.

**Reasoning:**
- Fine-grained control over state transitions — know exactly which node failed and why
- First-class SSE streaming support via `astream()` and event emission
- Built-in checkpointing for human-in-the-loop (future feature)
- Production-debuggable: LangSmith traces every node with input/output/latency
- CrewAI is faster to prototype but opaque in production, harder to debug or extend

**Trade-offs:** More boilerplate than CrewAI. Requires `TypedDict` state design upfront. Worth it for debuggability and precise error recovery.

---

## ADR-002: SSE over WebSockets for Streaming

**Date:** 2025-04-01
**Status:** Accepted

**Context:** Real-time agent progress streaming to frontend during multi-step search pipeline.

**Decision:** Server-Sent Events (SSE) via `sse-starlette`.

**Reasoning:**
- Unidirectional server→client is all we need (agent sends progress; client doesn't act mid-stream)
- Works over HTTP/1.1, no upgrade handshake required
- Browser `EventSource` API handles reconnection automatically
- No load balancer WebSocket configuration needed
- FastAPI `StreamingResponse` integrates cleanly

**Trade-offs:** Cannot send client messages mid-stream. Not needed for this use case — the search is fire-and-forget once started.

---

## ADR-003: Deterministic Scoring over Per-Profile LLM Scoring

**Date:** 2025-04-10
**Status:** Accepted

**Context:** Original ranking_agent made one LLM call per profile (up to 15 calls per search), adding latency and cost.

**Decision:** Python function with weighted criteria matching. Optional single-call rerank via `ENABLE_LLM_RERANK` flag for top 10.

**Reasoning:**
- 15 LLM calls → 0 LLM calls for ranking = **~70% cost reduction per search**
- Scoring criteria are well-defined and enumerable (role: 35pts, location: 25pts, keywords: 20pts, contactable: 10pts, seniority: 5pts, completeness: 5pts)
- Deterministic = testable, reproducible, debuggable (see `tests/unit/test_ranking.py`)
- LLM rerank available as optional quality boost behind a feature flag

**Trade-offs:** Less nuanced than LLM reasoning for edge cases. Mitigated by the optional rerank and tunable weights.

---

## ADR-004: In-Memory TTLCache over Redis for Caching

**Date:** 2025-04-10
**Status:** Accepted (Redis in v2 backlog)

**Context:** Need query result caching to avoid redundant Tavily/Serper API calls for repeated or similar searches.

**Decision:** `cachetools.TTLCache`-style in-process dict with namespace-based TTLs (Tavily: 72h, criteria: 4h).

**Reasoning:**
- Zero infrastructure — no Docker service, no connection pooling, no serialization
- Sufficient for single-process development and capstone demo
- 80% of Redis benefit for repeated searches within process lifetime
- Redis will be added in v2 when multi-process deployment requires shared cache

**Trade-offs:** Cache lost on restart. Not shared across multiple backend processes. Acceptable for capstone scope.

---

## ADR-005: Groq (Free) as Primary LLM, Claude Sonnet for Email Only

**Date:** 2025-04-01
**Status:** Accepted

**Context:** Need to control costs while maintaining quality across different pipeline tasks.

**Decision:** Route by task: Groq llama-3.1-8b for planning/extraction/routing (free tier). Claude Sonnet for email composition only (pay-per-use).

**Reasoning:**
- Groq: free tier, 100k TPD, sub-second latency, sufficient for structured JSON tasks
- Claude: best natural language quality for outreach emails where tone matters
- Cost per search: ~$0.00 for planning/ranking, ~$0.003 for email composition
- Fallback chain: Groq 8B → Groq 70B → OpenRouter → OpenAI (automatic failover)

**Trade-offs:** Groq has TPD rate limits. Mitigated by LLM Gateway with automatic fallback chain and rate-limit backoff.

---

## ADR-006: Session-Scoped Leads (Not Global Person Profiles)

**Date:** 2025-04-01
**Status:** Accepted (Global profiles in v2 backlog)

**Context:** Alternative design proposed replacing the `leads` table with persistent `person_profiles` shared across sessions.

**Decision:** Keep session-scoped leads. Defer global profiles to v2.

**Reasoning:**
- Current system works end-to-end — ripping out the leads table would break the entire pipeline
- Session-scoped design is intentional: allows per-search customisation of match scores
- Global profiles require separate ingestion infrastructure (dedup pipeline, merge logic)
- ChromaDB semantic cache gives 80% of the deduplication benefit without DB schema change

**Trade-offs:** Same person may appear across multiple sessions. Acceptable for v1 — dedup via ChromaDB addresses the worst cases.

---

## ADR-007: Versioned Prompt Files over Inline Strings

**Date:** 2025-04-15
**Status:** Accepted

**Context:** Prompts were hardcoded strings inside agent Python files, making them hard to version, test, and iterate.

**Decision:** Load prompts from `backend/prompts/name_v{n}.txt` files via `load_prompt()` utility.

**Reasoning:**
- Version control prompts independently from code (git diff on .txt files is clearer)
- `/health` endpoint reports current prompt versions (proves versioning to assessors)
- Enables A/B testing: run `supervisor_v1` vs `supervisor_v2` and compare MRR
- Non-engineers can improve prompts without touching Python code
- File caching in `load_prompt()` avoids repeated I/O

**Trade-offs:** Extra file I/O per request (mitigated by OS-level file cache). Must keep prompt filenames in sync with `load_prompt()` calls.

---

## ADR-008: ChromaDB (Local) over Pinecone for Vector Storage

**Date:** 2025-04-20
**Status:** Accepted (Pinecone in v2 backlog)

**Context:** Need vector storage for semantic search cache and RAG-style retrieval of past searches.

**Decision:** ChromaDB with `PersistentClient` (local file storage).

**Reasoning:**
- ChromaDB is already a dependency in `requirements.txt`
- Zero infrastructure — just a Python library with local files
- Pinecone requires account creation, index provisioning, API key management, $70+/month
- For capstone demo: ChromaDB delivers identical capability at zero cost
- Semantic cache at 92% similarity threshold enables meaningful dedup

**Trade-offs:** Not production-scalable for multi-process deployments. Migration to Pinecone is a config change, not a rewrite.
