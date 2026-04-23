# 07 · Getting Started

## Prerequisites
- Docker + Docker Compose
- Node 20+ (only if you want to run the frontend outside Docker)
- Python 3.11+ (only if you want to run the backend outside Docker)
- API keys: Anthropic, OpenAI (embeddings), Tavily

## 1. Configure

```bash
cp .env.example .env
# Edit .env, fill in your keys and JWT_SECRET_KEY (openssl rand -hex 32)
```

## 2. Boot

```bash
docker compose up -d postgres
docker compose up backend frontend
```

## 3. Smoke Test

```bash
curl http://localhost:8000/health
# -> {"status":"ok","version":"1.0.0","db":"connected","environment":"development"}

open http://localhost:5173
```

## 4. Register + search

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@nexus.ai","password":"demo12345","full_name":"Demo"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@nexus.ai","password":"demo12345"}' | jq -r .access_token)

# Search
curl -X POST http://localhost:8000/api/v1/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Find senior React developers in Nairobi"}'
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `Connection refused :5432` | `docker compose up -d postgres` and wait 10s |
| `ANTHROPIC_API_KEY not set` | Re-check `.env` (no spaces around `=`) |
| SSE stalls in prod | Confirm `proxy_buffering off` for stream routes |
| `alembic: command not found` | Inside the backend container: `alembic upgrade head` |
| CORS error in browser | `CORS_ORIGINS` must include your frontend origin exactly |
