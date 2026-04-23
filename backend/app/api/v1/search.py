"""Search endpoints: start a search, list/retrieve sessions, stream progress via SSE."""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import (
    _get_or_create_dev_user,
    get_current_user,
    get_db,
    resolve_user_from_token,
)
from app.models.search_session import SearchSession
from app.models.user import User
from app.schemas.search import (
    SearchRequest,
    SearchSessionList,
    SearchSessionOut,
    SearchStartResponse,
)
from app.services.graph_runner import format_sse, run_graph_streaming

logger = logging.getLogger(__name__)
router = APIRouter()


def _title_from_query(q: str, max_len: int = 60) -> str:
    """Trim the raw query into a human-readable session title."""
    q = q.strip().rstrip("?.!")
    if len(q) <= max_len:
        return q
    return q[: max_len - 1].rsplit(" ", 1)[0] + "…"


@router.post("", response_model=SearchStartResponse, status_code=201)
async def create_search(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchStartResponse:
    """Create a new SearchSession. The caller then connects to the SSE stream."""
    ss = SearchSession(
        user_id=user.id,
        title=_title_from_query(payload.query),
        original_query=payload.query,
        status="pending",
    )
    db.add(ss)
    db.commit()
    db.refresh(ss)

    return SearchStartResponse(
        session_id=ss.id,
        status=ss.status,
        message=(
            f"Search started. Connect to /api/v1/search/{ss.id}/stream for live updates."
        ),
    )


@router.get("", response_model=SearchSessionList)
async def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchSessionList:
    """List the current user's search sessions, most recent first."""
    rows = (
        db.query(SearchSession)
        .filter(SearchSession.user_id == user.id)
        .order_by(SearchSession.created_at.desc())
        .limit(100)
        .all()
    )
    return SearchSessionList(sessions=[SearchSessionOut.model_validate(r) for r in rows])


@router.get("/{session_id}", response_model=SearchSessionOut)
async def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchSessionOut:
    """Fetch a single search session (metadata only; leads are under /leads)."""
    ss = (
        db.query(SearchSession)
        .filter(SearchSession.id == session_id, SearchSession.user_id == user.id)
        .first()
    )
    if not ss:
        raise HTTPException(status_code=404, detail="Session not found")
    return SearchSessionOut.model_validate(ss)


def _auth_for_sse(request: Request, db: Session) -> User:
    """Resolve auth for SSE.

    EventSource cannot set custom headers, so we accept either:
    - Authorization: Bearer <token> header (non-browser clients), or
    - ?token=<jwt> query string (browser EventSource).

    When DISABLE_AUTH is on we fall back to the persistent dev user.
    """
    if settings.DISABLE_AUTH:
        return _get_or_create_dev_user(db)

    token: Optional[str] = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    user = resolve_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


@router.get("/{session_id}/stream")
async def stream_search(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """SSE stream of agent progress events for a session."""
    user = _auth_for_sse(request, db)

    ss = (
        db.query(SearchSession)
        .filter(SearchSession.id == session_id, SearchSession.user_id == user.id)
        .first()
    )
    if not ss:
        raise HTTPException(status_code=404, detail="Session not found")

    # Mark in-progress.
    ss.status = "searching"
    db.commit()

    query = ss.original_query
    sess_id = ss.id
    uid = user.id

    async def event_generator():
        try:
            async for event in run_graph_streaming(query, sess_id, uid):
                if await request.is_disconnected():
                    break
                yield format_sse(event)
        except Exception as exc:
            logger.exception("SSE generator crashed")
            yield format_sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
