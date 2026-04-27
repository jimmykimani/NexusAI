"""FastAPI application entry point for NexusAI."""
from __future__ import annotations

import app.langchain_compat  # noqa: F401 — before langgraph/langchain_core pull old attrs

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from sqlalchemy import text

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, engine

import os
if settings.LANGCHAIN_TRACING_V2:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT

# Importing models registers them with SQLAlchemy Base.metadata.
from app.models import lead, search_session, user  # noqa: F401

from app.core.logging import setup_logging

setup_logging(level=logging.INFO)
logger = logging.getLogger("nexusai")


def _ensure_sqlite_dev_columns() -> None:
    """Patch forward lightweight SQLite dev schemas when models add columns.

    ``create_all()`` does not alter existing tables, so local SQLite files can
    drift behind the ORM after we add columns like ``leads.source_query``.
    """
    if engine.dialect.name != "sqlite":
        return

    statements = {
        "leads": {
            "source_query": "ALTER TABLE leads ADD COLUMN source_query TEXT",
        },
    }

    with engine.begin() as conn:
        for table, missing_column_sql in statements.items():
            existing = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            }
            for column, sql in missing_column_sql.items():
                if column in existing:
                    continue
                conn.execute(text(sql))
                logger.info("SQLite dev schema patched: added %s.%s", table, column)


def _reconcile_stale_search_sessions() -> None:
    """Mark abandoned `searching` sessions as finished so old threads stop spinning."""
    from app.core.database import SessionLocal
    from app.models.lead import Lead
    from app.models.search_session import SearchSession

    db = SessionLocal()
    try:
        stale_before = datetime.utcnow() - timedelta(minutes=1)
        rows = (
            db.query(SearchSession)
            .filter(SearchSession.status == "searching", SearchSession.updated_at < stale_before)
            .all()
        )
        if not rows:
            return

        for session in rows:
            lead_count = db.query(Lead).filter(Lead.session_id == session.id).count()
            session.lead_count = lead_count
            if lead_count > 0:
                session.status = "complete"
                session.error = None
            else:
                session.status = "error"
                session.error = "This search did not finish cleanly. Please rerun or broaden the criteria."

        db.commit()
        logger.info("Reconciled %d stale search session(s).", len(rows))
    except Exception as exc:
        db.rollback()
        logger.warning("Could not reconcile stale search sessions: %s", exc)
    finally:
        db.close()


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
        _ensure_sqlite_dev_columns()
        _reconcile_stale_search_sessions()
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
