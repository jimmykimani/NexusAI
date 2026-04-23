"""FastAPI application entry point for NexusAI."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
# Importing models registers them with SQLAlchemy Base.metadata.
from app.models import lead, search_session, user  # noqa: F401

logger = logging.getLogger("nexusai")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup for dev convenience; prod uses Alembic."""
    try:
        settings.assert_llm_keys()
    except RuntimeError as exc:
        # Log loudly but don't crash — this lets the app boot for health
        # checks, and the first /search call will surface the same error.
        logger.error("Startup config error: %s", exc)

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ensured (dev mode).")
    except Exception as exc:
        logger.warning("Could not create tables at startup: %s", exc)
    yield


app = FastAPI(
    title="NexusAI",
    version="1.0.0",
    description="AI-powered people search and outreach platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.middleware("http")
async def guardrail_middleware(request: Request, call_next):
    """Basic prompt-injection / abuse check on search endpoints."""
    if request.url.path.endswith("/search") and request.method == "POST":
        try:
            body = await request.body()
            text = body.decode("utf-8", errors="ignore").lower()
            blocked = [
                "ignore previous instructions",
                "disregard the above",
                "system prompt:",
                "</system>",
            ]
            if any(phrase in text for phrase in blocked):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Query rejected by safety filter.", "code": "INVALID_QUERY"},
                )

            async def _receive():
                return {"type": "http.request", "body": body, "more_body": False}

            request._receive = _receive  # type: ignore[attr-defined]
        except Exception:
            pass
    return await call_next(request)


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_root() -> dict:
    """Liveness probe at the root for infra checks."""
    return {"status": "ok", "version": "1.0.0", "environment": settings.ENVIRONMENT}
