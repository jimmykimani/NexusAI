# 06 · Infrastructure

## Dev Compose

`docker-compose.yml` runs three services: `postgres`, `backend`, `frontend`. The backend mounts `./backend` for live reload, the frontend mounts `./frontend/src`.

```bash
docker compose up -d postgres
docker compose up backend frontend
```

## Prod Compose

`docker-compose.prod.yml` adds:

- A build-time static frontend bundle served by `nginx`.
- Backend with `--workers 2`.
- `nginx` reverse proxy at port 80 that disables buffering for SSE routes.

## Environment Variables
Everything is driven from `.env` (see `.env.example`).

| Name | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI embeddings key |
| `TAVILY_API_KEY` | Tavily search key |
| `DATABASE_URL` | Full Postgres DSN |
| `JWT_SECRET_KEY` | 32+ char secret for signing tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 1440) |
| `CORS_ORIGINS` | JSON list of allowed origins |
| `ENVIRONMENT` | `development` or `production` |

## Migrations

Alembic migrations live under `backend/alembic/versions`. On backend startup the app also runs `Base.metadata.create_all(engine)` for zero-friction local dev.

Run migrations explicitly:
```bash
docker compose exec backend alembic upgrade head
```

## Volumes
- `postgres_data` — durable PG storage.
- `./backend` — mounted in dev for hot reload.
- `./frontend/src` — mounted in dev for Vite HMR.
