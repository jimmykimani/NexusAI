# NexusAI

AI-powered people search and personalized outreach. Describe who you are looking for in plain English; NexusAI finds real people across the web, scores them against your criteria, and drafts personalized outreach.

## Quickstart

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, JWT_SECRET_KEY

docker compose up -d postgres
docker compose up backend frontend
```

Open http://localhost:5173 (frontend) and http://localhost:8000/docs (API docs).

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.11) + LangGraph + SQLAlchemy |
| LLMs | `claude-sonnet-4-5` (reasoning) + `claude-haiku-4-5` (scoring) |
| Search | Tavily API |
| Vectors | ChromaDB (dev) |
| DB | PostgreSQL 15 (JSONB for lead metadata) |
| Frontend | React 18 + TypeScript + Zustand + TailwindCSS |
| Streaming | Server-Sent Events |

## Docs

- [01 - System Overview](docs/01-system-overview.md)
- [02 - Backend](docs/02-backend.md)
- [03 - Frontend](docs/03-frontend.md)
- [04 - API Reference](docs/04-api-reference.md)
- [05 - Data Flow](docs/05-data-flow.md)
- [06 - Infrastructure](docs/06-infrastructure.md)
- [07 - Getting Started](docs/07-getting-started.md)
- [08 - ADRs](docs/08-adrs.md)
