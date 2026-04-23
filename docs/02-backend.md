# 02 · Backend Architecture

## Layout

```
backend/app/
├── main.py              # FastAPI entry
├── core/                # config, security, deps, database
├── api/v1/              # route handlers
├── agents/              # LangGraph nodes + graph
├── models/              # SQLAlchemy ORM
├── schemas/             # Pydantic I/O
└── services/            # external wrappers (Tavily, embeddings, email)
```

## Key Modules

- `core/config.py` — pydantic-settings from `.env`.
- `core/database.py` — SQLAlchemy engine + `SessionLocal`.
- `core/security.py` — bcrypt hashing, JWT encode/decode.
- `core/deps.py` — `get_db`, `get_current_user` dependencies.

## Agent Nodes

- `agents/state.py` — `NexusState` TypedDict with append-only `events`.
- `agents/graph.py` — `StateGraph` wiring `supervisor → search → ranking → END`.
- `agents/supervisor.py` — Claude Sonnet decomposes query into JSON criteria.
- `agents/search_agent.py` — Tavily multi-query fan-out + Claude extraction.
- `agents/ranking_agent.py` — Claude Haiku scoring against criteria.
- `agents/outreach_agent.py` — Claude Sonnet personalized email composer.

## Guardrails

Every agent node wraps its body in try/except, emits a stream event, and on error returns `{"status": "error", "error": "..."}` — the graph always completes cleanly.

A basic prompt-injection guardrail lives in `core/security.py::sanitize_query`.
