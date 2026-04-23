"""Health probe endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db

router = APIRouter()


@router.get("/health")
async def health(db: Session = Depends(get_db)) -> dict:
    """Return DB + service health for liveness checks."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"
    return {
        "status": "ok",
        "version": "1.0.0",
        "db": db_status,
        "environment": settings.ENVIRONMENT,
        "auth_disabled": settings.DISABLE_AUTH,
        "llm_provider": settings.LLM_PROVIDER,
        "clerk_issuer": settings.CLERK_ISSUER or None,
    }
