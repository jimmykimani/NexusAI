"""Admin-style helpers used by the Settings UI (stubs until log persistence exists)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user, get_db
from app.models.user import User
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/agent-logs")
async def list_agent_logs(
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Return recent agent logs (empty until a log table is added)."""
    _ = (db, user, limit)
    return {"logs": []}
