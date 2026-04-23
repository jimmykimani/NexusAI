"""Ranking agent — scores each extracted profile against the search criteria."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from app.agents.state import NexusState
from app.services.llm import llm_chat

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> dict[str, Any]:
    """Tolerant JSON object extractor."""
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


async def ranking_node(state: NexusState) -> NexusState:
    """Scores each profile against search criteria using the fast-tier model."""
    raw_results = state.get("raw_results", []) or []
    criteria = state.get("criteria", {}) or {}

    events: list[dict[str, Any]] = [
        {
            "type": "ranking",
            "message": (
                f"Ranking time — I'm scoring {len(raw_results)} profiles for fit so the "
                "table shows the strongest matches first."
            ),
            "data": {"profile_count": len(raw_results)},
        }
    ]

    rank_prompt = (
        "Score this person against the search criteria.\n"
        f"Criteria: {json.dumps(criteria)}\n\n"
        "Respond ONLY with JSON in this shape:\n"
        '{"score": <0-100 integer>, '
        '"matched_criteria": {"role": bool, "location": bool, "seniority": bool, "industry": bool, "keywords": bool}, '
        '"match_status": "fully_matched" | "partially_matched", '
        '"reasoning": "one sentence"}'
        "\n\nRules: use fully_matched only when score >= 86 AND the person clearly "
        "fits the user's intent (role/niche + location or industry where given). "
        "Otherwise partially_matched — include borderline influencers, thin bios, "
        "or weak location/skill signals even if the score is high."
    )

    def _score_one(profile: dict[str, Any]) -> dict[str, Any]:
        try:
            text = llm_chat(
                system=rank_prompt,
                user=json.dumps(profile)[:4000],
                tier="fast",
                max_tokens=300,
                temperature=0.0,
                json_response=True,
            )
            parsed = _extract_json(text)
            score = float(parsed.get("score", 50) or 50)
            status = parsed.get("match_status") or (
                "fully_matched" if score >= 86 else "partially_matched"
            )
            return {
                **profile,
                "match_score": score,
                "match_status": status,
                "matched_criteria": parsed.get("matched_criteria", {}),
                "reasoning": parsed.get("reasoning", ""),
            }
        except Exception as exc:
            logger.warning("Ranking failed for profile, defaulting: %s", exc)
            return {
                **profile,
                "match_score": 50.0,
                "match_status": "partially_matched",
                "matched_criteria": {},
                "reasoning": "Defaulted due to ranking error.",
            }

    # Score profiles concurrently so 20+ leads don't queue one-by-one.
    tasks = [asyncio.to_thread(_score_one, p) for p in raw_results]
    scored = list(await asyncio.gather(*tasks)) if tasks else []

    scored.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    fully = [l for l in scored if l.get("match_status") == "fully_matched"]
    partial = [l for l in scored if l.get("match_status") != "fully_matched"]

    events.append(
        {
            "type": "complete",
            "message": (
                f"Table is ready — {len(fully)} strong fits and {len(partial)} partial fits "
                f"({len(scored)} people total)."
            ),
            "data": {"leads": scored},
        }
    )

    return {"leads": scored, "status": "complete", "events": events}
