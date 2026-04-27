"""Health probe endpoint — reports prompt versions, git hash, cache and LLM stats."""
from __future__ import annotations

import subprocess

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.core.prompts import all_versions
from app.services import cache
from app.services.llm import gateway_stats

router = APIRouter()

# Compute git hash once at import time (cheap, cached in module).
try:
    _GIT_HASH = (
        subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        )
        .decode()
        .strip()
    )
except Exception:
    _GIT_HASH = "unknown"


@router.get("/health")
async def health(db: Session = Depends(get_db)) -> dict:
    """Return DB + service health, prompt versions, cache and LLM stats for liveness checks."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"
    return {
        "status": "ok",
        "version": "1.0.0",
        "git_hash": _GIT_HASH,
        "db": db_status,
        "environment": settings.ENVIRONMENT,
        "auth_disabled": settings.DISABLE_AUTH,
        "llm_provider": settings.LLM_PROVIDER,
        "clerk_issuer": settings.CLERK_ISSUER or None,
        "prompt_versions": all_versions(),
        "cache": cache.stats(),
        "llm_gateway": gateway_stats(),
    }
