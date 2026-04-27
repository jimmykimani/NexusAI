"""Orchestrates running the LangGraph pipeline and streaming events via SSE.

Design:
- `run_graph_streaming` is an async generator that invokes the graph and yields
  `StreamEvent` dicts as each node appends to `state["events"]`.
- The graph is synchronous-friendly, but we use asyncio.to_thread to avoid blocking.
- On completion we persist Leads to the database.
"""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import time
from typing import Any, AsyncGenerator
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.lead import Lead
from app.models.search_session import SearchSession
from app.services.llm_runtime import LLMRequestOverride, llm_request_context
from app.services.session_title import title_from_criteria

logger = logging.getLogger(__name__)


def _persist_results(session_id: UUID, state: dict[str, Any]) -> None:
    """Persist criteria, status, and leads for a completed session."""
    db: Session = SessionLocal()
    try:
        ss = db.query(SearchSession).filter(SearchSession.id == session_id).first()
        if not ss:
            logger.warning("SearchSession %s disappeared during run", session_id)
            return

        criteria = dict(state.get("criteria") or {})
        run_q = (state.get("query") or "").strip()
        prev_hist = list((ss.criteria or {}).get("query_history") or [])
        if run_q and (not prev_hist or prev_hist[-1] != run_q):
            prev_hist.append(run_q)
        criteria["query_history"] = prev_hist[-30:]
        ss.criteria = criteria
        ss.status = state.get("status", "complete")
        ss.error = state.get("error")
        try:
            ss.title = title_from_criteria(criteria, ss.original_query or "")
        except Exception:
            logger.debug("Could not derive title from criteria", exc_info=True)

        leads_data = state.get("leads") or []

        def _coerce_int(val: Any) -> int | None:
            try:
                if val is None or val == "":
                    return None
                return int(float(str(val).replace(",", "")))
            except (TypeError, ValueError):
                return None

        src_q = run_q or None
        for profile in leads_data:
            db.add(
                Lead(
                    session_id=session_id,
                    source_query=src_q,
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
        db.flush()
        ss.lead_count = db.query(Lead).filter(Lead.session_id == session_id).count()
        db.commit()
    except Exception:
        logger.exception("Failed to persist graph results for %s", session_id)
        db.rollback()
    finally:
        db.close()


def _persist_turn_summary(
    session_id: UUID,
    query: str,
    assistant_summary: str,
    status: str | None,
    lead_count: int,
    events: list[dict[str, Any]] | None = None,
) -> None:
    """Store per-turn summary text inside session criteria for chat rehydration."""
    db: Session = SessionLocal()
    try:
        ss = db.query(SearchSession).filter(SearchSession.id == session_id).first()
        if not ss:
            logger.warning("SearchSession %s disappeared before turn summary persist", session_id)
            return

        criteria = dict(ss.criteria or {})
        history = list(criteria.get("turn_history") or [])
        history.append(
            {
                "query": query.strip(),
                "assistant_summary": assistant_summary.strip(),
                "status": status or "complete",
                "lead_count": lead_count,
                "events": events or [],
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        criteria["turn_history"] = history[-30:]
        criteria["latest_assistant_summary"] = assistant_summary.strip()
        ss.criteria = criteria
        db.commit()
    except Exception:
        logger.exception("Failed to persist turn summary for %s", session_id)
        db.rollback()
    finally:
        db.close()


def _load_session_leads_json(session_id: UUID) -> list[dict[str, Any]]:
    """Return persisted leads for SSE (real UUIDs) — same shape as GET /leads."""
    from app.schemas.lead import LeadOut

    db: Session = SessionLocal()
    try:
        rows = (
            db.query(Lead)
            .filter(Lead.session_id == session_id)
            .order_by(Lead.created_at.desc(), Lead.match_score.desc())
            .all()
        )
        return [LeadOut.model_validate(r).model_dump(mode="json") for r in rows]
    finally:
        db.close()


async def run_graph_streaming(
    query: str,
    session_id: UUID,
    user_id: UUID,
    chat_history: list[dict[str, str]] | None = None,
    llm_override: LLMRequestOverride | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run the agent graph and yield SSE-ready events as nodes produce them.

    Uses LangGraph's `astream` to receive per-node state updates. Each update may
    include newly-appended `events`; we yield those to the caller for SSE emission.

    Before the graph: streams a short persona intro (`persona_chunk`).
    After the graph: streams a closing summary, then `meta` (elapsed_ms) and
    `stream_end` so the client can close the EventSource cleanly.

    ``llm_override`` applies only for this run (e.g. model chosen in the chat UI).
    """
    from app.services.llm_runtime import LLMRequestOverride, llm_request_context, llm_tracking_context
    from app.services.search_narrative import (  # noqa: PLC0415
        stream_intro_narrative,
        stream_outro_narrative,
        stream_feedback_message,
    )

    with llm_request_context(llm_override), llm_tracking_context(str(user_id), str(session_id)):
        t0 = time.perf_counter()

        # Opening persona (streamed when using an OpenAI-compatible provider).
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
            "chat_history": chat_history or [],
            "events": [],
        }

        final_state: dict[str, Any] = dict(initial_state)
        seen_event_count = 0
        buffered_complete: dict[str, Any] | None = None

        try:
            # Lazy import so heavy agent deps (langgraph, anthropic, tavily) are
            # only loaded when a search actually runs — keeps app startup fast.
            from app.agents.graph import nexus_graph  # noqa: PLC0415

            logger.info(f"Starting graph for session {session_id} with query: {query}")
            async for update in nexus_graph.astream(initial_state, stream_mode="values"):
                # Merge into final_state so we know the last known full state.
                if isinstance(update, dict):
                    for k, v in update.items():
                        final_state[k] = v

                events = final_state.get("events", []) or []
                # Emit any newly-appended events (hold ``complete`` until after DB persist).
                while seen_event_count < len(events):
                    ev = events[seen_event_count]
                    seen_event_count += 1
                    if isinstance(ev, dict) and ev.get("type") == "complete":
                        buffered_complete = ev
                        continue
                    yield ev
        except (Exception, asyncio.CancelledError) as exc:
            if isinstance(exc, asyncio.CancelledError):
                logger.info("Graph run cancelled for %s", session_id)
                final_state["status"] = "error"
                final_state["error"] = "Search cancelled or connection lost."
            else:
                logger.exception("Graph run failed")
                yield {"type": "error", "message": f"Search failed: {exc}"}
                final_state["status"] = "error"
                final_state["error"] = str(exc)
        finally:
            # Persist while the client still has the connection open, *before* the
            # closing narrative so `/leads` refresh after `complete` never races the DB.
            try:
                await asyncio.to_thread(_persist_results, session_id, final_state)
            except Exception:
                logger.exception("Persist step failed")

        graph_failed = final_state.get("status") == "error" or bool(final_state.get("error"))
        if buffered_complete is not None:
            if not graph_failed:
                try:
                    hydrated = await asyncio.to_thread(_load_session_leads_json, session_id)
                    ev = copy.deepcopy(buffered_complete)
                    data = dict(ev.get("data") or {})
                    data["leads"] = hydrated
                    ev["data"] = data
                    yield ev
                except Exception:
                    logger.exception("Hydrating SSE complete leads failed; sending raw event")
                    yield buffered_complete
            else:
                yield buffered_complete

        # Closing persona + timing (after graph events, including `complete`).
        leads = final_state.get("leads") or []
        criteria = final_state.get("criteria") or {}
        status = final_state.get("status")
        outro_parts: list[str] = []
        if not graph_failed:
            try:
                logger.info("Streaming feedback message for query: %s", query)
                async for piece in stream_feedback_message(query, criteria, leads):
                    if piece:
                        outro_parts.append(piece)
                        logger.debug("Yielding feedback chunk: %s", piece)
                        yield {
                            "type": "persona_chunk",
                            "message": "",
                            "data": {"phase": "outro", "text": piece},
                        }
            except Exception as exc:
                logger.warning("Feedback narrative skipped: %s", exc)
                # Fallback to old outro if feedback fails
                try:
                    async for piece in stream_outro_narrative(query, criteria, leads, status):
                        if piece:
                            outro_parts.append(piece)
                            yield {
                                "type": "persona_chunk",
                                "message": "",
                                "data": {"phase": "outro", "text": piece},
                            }
                except Exception:
                    pass
        outro_text = "".join(outro_parts).strip()
        if not graph_failed and outro_text:
            try:
                await asyncio.to_thread(
                    _persist_turn_summary,
                    session_id,
                    query,
                    outro_text,
                    status if isinstance(status, str) else "complete",
                    len(leads),
                    final_state.get("events") or [],
                )
            except Exception:
                logger.exception("Turn summary persist failed")

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        yield {"type": "meta", "message": "timing", "data": {"elapsed_ms": elapsed_ms}}
        yield {"type": "stream_end", "message": "", "data": {}}


def format_sse(event: dict[str, Any]) -> str:
    """Format an event dict as a single SSE `data:` frame."""
    return f"data: {json.dumps(event)}\n\n"
