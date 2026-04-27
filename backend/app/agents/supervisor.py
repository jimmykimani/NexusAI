"""Supervisor agent — decomposes free-text queries into structured criteria."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.agents.state import NexusState
from app.services.llm import llm_chat
from app.core.prompts import load_prompt
# from app.services.chroma_storage import query_semantic_cache, store_search

logger = logging.getLogger(__name__)


def get_supervisor_prompt() -> str:
    return load_prompt("supervisor", "v1")





def _extract_json(text: str) -> dict[str, Any]:
    """Extract the first JSON object from an LLM response.

    Returns an empty dict if no valid JSON can be found — never raises.
    """
    if not text or not text.strip():
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}
        return {}


async def supervisor_node(state: NexusState) -> NexusState:
    """Decomposes user query into structured search criteria."""
    events = [
        {
            "type": "plan",
            "message": "On it — I'm breaking your ask into signals we can search the web for…",
        }
    ]

    chat_history = state.get("chat_history", [])
    history_text = ""
    if chat_history:
        history_lines = []
        for t in chat_history:
            history_lines.append(f"User: {t.get('query')}")
            if t.get('assistant_summary'):
                history_lines.append(f"Assistant: {t.get('assistant_summary')}")
        history_text = "PREVIOUS CHAT HISTORY:\n" + "\n".join(history_lines) + "\n\n"

    retry_count = state.get("retry_count", 0)
    retry_feedback = ""
    if retry_count > 0:
        retry_feedback = (
            f"\n\n[SYSTEM MESSAGE: RETRIAL ATTEMPT #{retry_count}]\n"
            "The previous search yielded insufficient results. "
            "Please broaden your criteria (less restrictive keywords) or "
            "try different search strings to capture a wider pool of relevant people."
        )

    try:
        raw_text = llm_chat(
            system=get_supervisor_prompt(),
            user=f"{history_text}CURRENT REQUEST: {state['query']}{retry_feedback}",
            tier="fast",
            max_tokens=1400,
            temperature=0.15,
            json_response=True,
        )
        parsed = _extract_json(raw_text or "{}")

        criteria = parsed.get("criteria", {}) or {}
        queries = parsed.get("search_queries", []) or []

        # Part 11: Store for future semantic hits (Disabled for demo)
        # if settings.ENABLE_CHROMA and criteria:
        #     ...


        # Normalize common fields so downstream nodes never have to guess.
        criteria.setdefault("person_type", "other")
        criteria.setdefault("platforms", [])
        criteria.setdefault("keywords", [])
        criteria.setdefault("roles", [])
        criteria.setdefault("location", "")
        criteria.setdefault("industry", "")
        criteria.setdefault("seniority", "unspecified")
        criteria.setdefault("min_followers", 0)

        events.append(
            {
                "type": "plan",
                "message": "Here's the game plan — I'll fan this out across the angles below.",
                "data": {
                    "criteria": criteria,
                    "queries": queries,
                    "confidence": parsed.get("confidence", 0.7),
                },
            }
        )

        return {
            "criteria": criteria,
            "search_queries": queries,
            "status": "searching",
            "events": events,
        }
    except Exception as exc:
        logger.exception("Supervisor node failed")
        events.append({"type": "error", "message": f"Supervisor failed: {exc}"})
        return {"status": "error", "error": str(exc), "events": events}
