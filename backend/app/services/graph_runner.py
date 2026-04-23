"""Orchestrates running the LangGraph pipeline and streaming events via SSE.

Design:
- `run_graph_streaming` is an async generator that invokes the graph and yields
  `StreamEvent` dicts as each node appends to `state["events"]`.
- The graph is synchronous-friendly, but we use asyncio.to_thread to avoid blocking.
- On completion we persist Leads to the database.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.lead import Lead
from app.models.search_session import SearchSession

logger = logging.getLogger(__name__)


def _persist_results(session_id: UUID, state: dict[str, Any]) -> None:
    """Persist criteria, status, and leads for a completed session."""
    db: Session = SessionLocal()
    try:
        ss = db.query(SearchSession).filter(SearchSession.id == session_id).first()
        if not ss:
            logger.warning("SearchSession %s disappeared during run", session_id)
            return

        ss.criteria = state.get("criteria") or {}
        ss.status = state.get("status", "complete")
        ss.error = state.get("error")

        leads_data = state.get("leads") or []

        def _coerce_int(val: Any) -> int | None:
            try:
                if val is None or val == "":
                    return None
                return int(float(str(val).replace(",", "")))
            except (TypeError, ValueError):
                return None

        for profile in leads_data:
            db.add(
                Lead(
                    session_id=session_id,
                    name=profile.get("name"),
                    title=profile.get("title"),
                    headline=profile.get("headline") or profile.get("title"),
                    company=profile.get("company"),
                    location=profile.get("location"),
                    country_code=(profile.get("country_code") or "").upper() or None,
                    email=profile.get("email"),
                    linkedin_url=profile.get("linkedin_url"),
                    github_url=profile.get("github_url"),
                    twitter_url=profile.get("twitter_url"),
                    instagram_url=profile.get("instagram_url"),
                    tiktok_url=profile.get("tiktok_url"),
                    youtube_url=profile.get("youtube_url"),
                    website_url=profile.get("website_url"),
                    avatar_url=profile.get("avatar_url"),
                    source_url=profile.get("source_url"),
                    followers=_coerce_int(profile.get("followers")),
                    person_type=profile.get("person_type"),
                    match_score=float(profile.get("match_score", 0) or 0),
                    match_status=profile.get("match_status", "partially_matched"),
                    matched_criteria=profile.get("matched_criteria") or {},
                    bio=profile.get("bio"),
                    ai_summary=profile.get("ai_summary") or profile.get("bio"),
                    skills=profile.get("skills") or [],
                    experience=profile.get("experience") or [],
                    raw_data=profile,
                )
            )
        ss.lead_count = len(leads_data)
        db.commit()
    except Exception:
        logger.exception("Failed to persist graph results for %s", session_id)
        db.rollback()
    finally:
        db.close()


async def run_graph_streaming(
    query: str, session_id: UUID, user_id: UUID
) -> AsyncGenerator[dict[str, Any], None]:
    """Run the agent graph and yield SSE-ready events as nodes produce them.

    Uses LangGraph's `astream` to receive per-node state updates. Each update may
    include newly-appended `events`; we yield those to the caller for SSE emission.

    Before the graph: streams a short persona intro (`persona_chunk`).
    After the graph: streams a closing summary, then `meta` (elapsed_ms) and
    `stream_end` so the client can close the EventSource cleanly.
    """
    from app.services.search_narrative import (  # noqa: PLC0415
        stream_intro_narrative,
        stream_outro_narrative,
    )

    t0 = time.perf_counter()

    # Opening persona (streamed token-by-token on OpenAI).
    try:
        async for piece in stream_intro_narrative(query):
            if piece:
                yield {
                    "type": "persona_chunk",
                    "message": "",
                    "data": {"phase": "intro", "text": piece},
                }
    except Exception as exc:
        logger.warning("Intro narrative skipped: %s", exc)

    initial_state: dict[str, Any] = {
        "query": query,
        "session_id": str(session_id),
        "user_id": str(user_id),
        "events": [],
    }

    final_state: dict[str, Any] = dict(initial_state)
    seen_event_count = 0

    try:
        # Lazy import so heavy agent deps (langgraph, anthropic, tavily) are
        # only loaded when a search actually runs — keeps app startup fast.
        from app.agents.graph import nexus_graph  # noqa: PLC0415

        async for update in nexus_graph.astream(initial_state, stream_mode="values"):
            # Merge into final_state so we know the last known full state.
            if isinstance(update, dict):
                for k, v in update.items():
                    final_state[k] = v

            events = final_state.get("events", []) or []
            # Emit any newly-appended events.
            while seen_event_count < len(events):
                yield events[seen_event_count]
                seen_event_count += 1
    except Exception as exc:
        logger.exception("Graph run failed")
        yield {"type": "error", "message": f"Search failed: {exc}"}
        final_state["status"] = "error"
        final_state["error"] = str(exc)

    # Persist while the client still has the connection open, *before* the
    # closing narrative so `/leads` refresh after `complete` never races the DB.
    try:
        await asyncio.to_thread(_persist_results, session_id, final_state)
    except Exception:
        logger.exception("Persist step failed")

    # Closing persona + timing (after graph events, including `complete`).
    leads = final_state.get("leads") or []
    criteria = final_state.get("criteria") or {}
    status = final_state.get("status")
    graph_failed = final_state.get("status") == "error" or bool(final_state.get("error"))
    if not graph_failed:
        try:
            async for piece in stream_outro_narrative(query, criteria, leads, status):
                if piece:
                    yield {
                        "type": "persona_chunk",
                        "message": "",
                        "data": {"phase": "outro", "text": piece},
                    }
        except Exception as exc:
            logger.warning("Outro narrative skipped: %s", exc)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    yield {"type": "meta", "message": "timing", "data": {"elapsed_ms": elapsed_ms}}
    yield {"type": "stream_end", "message": "", "data": {}}


def format_sse(event: dict[str, Any]) -> str:
    """Format an event dict as a single SSE `data:` frame."""
    return f"data: {json.dumps(event)}\n\n"
