"""Search endpoints: start a search, list/retrieve sessions, stream progress via SSE."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

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
    ConversationStartResponse,
    SearchRequest,
    SearchSessionList,
    SearchSessionOut,
    SearchStartResponse,
)
from app.services.conversation_reply import conversational_reply
from app.services.session_title import title_from_query
from app.services.turn_intent import resolve_intent
from app.services.graph_runner import format_sse, run_graph_streaming
from app.services.llm_runtime import LLMRequestOverride, validate_override

logger = logging.getLogger(__name__)
router = APIRouter()


def _llm_override_from_stream_request(request: Request) -> LLMRequestOverride | None:
    """Parse optional per-search LLM selection from SSE query string."""
    p = request.query_params.get("llm_provider")
    r = request.query_params.get("llm_reasoning_model")
    f = request.query_params.get("llm_fast_model")
    if not p and not r and not f:
        return None
    if not p or not r or not f:
        raise HTTPException(
            status_code=400,
            detail="Send all of llm_provider, llm_reasoning_model, and llm_fast_model, or omit all three.",
        )
    try:
        return validate_override(p, r, f)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("", response_model=SearchStartResponse | ConversationStartResponse, status_code=200)
async def create_search(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchStartResponse | ConversationStartResponse:
    """Start a people search, or return a chat reply when the message is conversational."""
    q = payload.query.strip()
    cont = payload.continue_session_id

    # Gather chat history for memory support
    chat_history = []
    if cont:
        ss_prev = db.query(SearchSession).filter(SearchSession.id == cont, SearchSession.user_id == user.id).first()
        if ss_prev and isinstance(ss_prev.criteria, dict):
            chat_history = ss_prev.criteria.get("turn_history", [])

    intent = await asyncio.to_thread(resolve_intent, q)
    if intent == "conversation":
        try:
            reply = await asyncio.to_thread(conversational_reply, q, chat_history=chat_history)
        except Exception as exc:
            logger.warning("Conversation reply failed: %s", exc)
            reply = (
                "Hey — I’m here. Something hiccupped on my side, but I’m ready when you are. "
                "Tell me who you want to find (role, company, or niche) and I’ll run a real search."
            )
        
        # Persist chat memory to the session if it exists
        if cont:
            ss_mem = db.query(SearchSession).filter(SearchSession.id == cont, SearchSession.user_id == user.id).first()
            if ss_mem:
                criteria = ss_mem.criteria or {}
                if not isinstance(criteria, dict): criteria = {}
                history = criteria.get("turn_history", []) or []
                history.append({
                    "id": str(uuid4()),
                    "query": q,
                    "user_message": q,
                    "assistant_summary": reply,
                    "status": "chat",
                    "session_id": str(ss_mem.id),
                    "created_at": datetime.utcnow().isoformat()
                })
                criteria["turn_history"] = history
                ss_mem.criteria = criteria
                db.add(ss_mem)
                db.commit()

        return ConversationStartResponse(reply=reply)

    q = payload.query.strip()
    cont = payload.continue_session_id

    if cont is not None:
        ss = (
            db.query(SearchSession)
            .filter(SearchSession.id == cont, SearchSession.user_id == user.id)
            .first()
        )
        if not ss:
            raise HTTPException(status_code=404, detail="Session not found")
        if ss.status == "searching":
            stale_threshold = datetime.utcnow() - timedelta(seconds=30)
            if ss.updated_at and ss.updated_at < stale_threshold:
                # Force-mark as error so new search can proceed
                ss.status = "error"
                ss.error = "Previous search took too long or connection was lost. Retrying..."
                db.commit()
            else:
                raise HTTPException(
                    status_code=409,
                    detail="This workspace already has a search in progress. Wait for it to finish.",
                )
        ss.status = "pending"
        ss.error = None
        ss.title = title_from_query(q)
        criteria = dict(ss.criteria) if isinstance(ss.criteria, dict) else {}
        criteria["current_query"] = q
        ss.criteria = criteria
        db.commit()
        db.refresh(ss)
    else:
        ss = SearchSession(
            user_id=user.id,
            title=title_from_query(q),
            original_query=q,
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

    # Extract past conversation history for LLM memory
    criteria = ss.criteria or {}
    if not isinstance(criteria, dict):
        criteria = {}
        
    # Prioritize the query passed in the URL (bypass DB race conditions)
    q_param = request.query_params.get("q")
    logger.info(f"SSE Connection: sessionId={session_id}, q_param={q_param}")
    query = q_param if q_param else (criteria.get("current_query") or ss.original_query)
        
    sess_id = ss.id
    uid = user.id
    
    chat_history = criteria.get("turn_history", [])
    
    llm_override = _llm_override_from_stream_request(request)

    async def event_generator():
        queue = asyncio.Queue()

        async def _run():
            try:
                async for event in run_graph_streaming(
                    query, sess_id, uid, chat_history=chat_history, llm_override=llm_override
                ):
                    await queue.put(event)
            except Exception as exc:
                logger.exception("SSE generator crashed")
                await queue.put({"type": "error", "message": str(exc)})
            finally:
                await queue.put(None)

        task = asyncio.create_task(_run())

        try:
            while True:
                try:
                    # Wait for an event with a timeout for heartbeat.
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if event is None:
                        break
                    if await request.is_disconnected():
                        break
                    yield format_sse(event)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        break
                    yield format_sse({"type": "ping", "message": "keep-alive"})
        finally:
            task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
