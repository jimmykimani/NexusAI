"""Supervisor agent — decomposes free-text queries into structured criteria."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.agents.state import NexusState
from app.services.llm import llm_chat

logger = logging.getLogger(__name__)


SUPERVISOR_PROMPT = """You are NexusAI's Search Supervisor. You decompose free-text
"find me" requests into a structured search plan that a downstream web-search agent
can execute.

You handle ANY type of person: influencers, creators, executives (CEOs, founders),
engineers, researchers, designers, investors, talent, athletes, artists, academics,
journalists, students. Do not assume it is only engineers.

Respond with ONLY a single JSON object in this shape, no prose:

{
  "criteria": {
    "person_type": "creator|influencer|executive|founder|engineer|designer|investor|researcher|journalist|talent|academic|other",
    "roles": ["job titles or creator niches, e.g. 'Beauty Creator', 'CEO', 'ML Engineer'"],
    "location": "city, country or country or region (use empty string if none)",
    "industry": "industry or content niche",
    "seniority": "junior|mid|senior|executive|celebrity|unspecified",
    "platforms": ["subset of: linkedin, github, twitter, tiktok, instagram, youtube, crunchbase, medium, personal_sites"],
    "keywords": ["skills, signals, follower thresholds, keywords to look for"],
    "min_followers": 0
  },
  "search_queries": [
    "6-10 highly targeted web-search strings. Mix broad queries with platform-specific site: queries.",
    "Always include at least one site:linkedin.com/in query when relevant.",
    "For creators, include site:tiktok.com, site:instagram.com, site:youtube.com queries.",
    "For executives, include site:crunchbase.com, site:linkedin.com/in, and 'CEO at X' style queries.",
    "For engineers, include site:github.com and site:linkedin.com queries.",
    "Add location to queries when the user specified one."
  ],
  "confidence": 0.0
}

Guidance for search_queries:
- Produce 6-10 queries (more is better; downstream will cap).
- Each query must be 3-12 words; never add quotes.
- Use `site:` operators to target platforms. Examples:
    - site:linkedin.com/in "beauty creator" Kenya
    - site:tiktok.com beauty creator 100k followers
    - site:instagram.com skincare creator Nairobi
    - site:crunchbase.com fintech CEO Kenya
    - site:github.com AI engineer Nairobi
    - "startup CEO" Kenya fintech 2024
- Include the location (if any) in most queries.
- If the user mentioned follower counts or seniority, reflect that in criteria AND queries.

Think briefly before responding, but output ONLY the JSON object.
"""


def _extract_json(text: str) -> dict[str, Any]:
    """Extract the first JSON object from an LLM response."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


async def supervisor_node(state: NexusState) -> NexusState:
    """Decomposes user query into structured search criteria."""
    events = [
        {
            "type": "plan",
            "message": "On it — I'm breaking your ask into signals we can search the web for…",
        }
    ]

    try:
        raw_text = llm_chat(
            system=SUPERVISOR_PROMPT,
            user=state["query"],
            tier="reasoning",
            max_tokens=1400,
            temperature=0.15,
            json_response=True,
        )
        parsed = _extract_json(raw_text or "{}")

        criteria = parsed.get("criteria", {}) or {}
        queries = parsed.get("search_queries", []) or []

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
