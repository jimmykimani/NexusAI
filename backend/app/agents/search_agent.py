"""Search agent — queries Tavily across platforms and extracts structured profiles.

Covers every kind of person (creators, execs, engineers, talent, researchers) by:
1. Running 6-8 parallel Tavily queries produced by the Supervisor.
2. Pulling richer content per query (more results, advanced depth).
3. Asking the LLM to extract up to ~25 profiles with social handles, follower
   counts, avatar URLs and a short AI summary.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from tavily import TavilyClient

from app.agents.state import NexusState
from app.core.config import settings
from app.services.llm import llm_chat

logger = logging.getLogger(__name__)

_tavily: TavilyClient | None = None

# Caps kept high but finite so we never blow LLM context.
MAX_QUERIES = 8
MAX_RESULTS_PER_QUERY = 8
MAX_SOURCES_TO_LLM = 28
MAX_CONTENT_CHARS = 1400


def _get_tavily() -> TavilyClient:
    """Lazily initialize the Tavily client."""
    global _tavily
    if _tavily is None:
        if not settings.TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY is not set.")
        _tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)
    return _tavily


EXTRACT_PROMPT = """You extract REAL, NAMED individuals from the provided web search
results. The target may be any kind of person — a creator, influencer, executive,
CEO, founder, engineer, researcher, designer, investor, athlete, academic,
journalist, or any other talent.

Return ONLY a JSON object shaped:

{
  "profiles": [
    {
      "name": "Full name",
      "title": "Role / headline line, e.g. 'Beauty Creator', 'CEO @ Acme', 'ML Engineer'",
      "headline": "short descriptive line if present (can be same as title)",
      "company": "Organization, brand, or 'Independent' for creators",
      "location": "City, Country or just Country",
      "country_code": "ISO-3166 alpha-2 (e.g. US, KE, GB) if you can infer",
      "person_type": "creator|influencer|executive|founder|engineer|designer|investor|researcher|journalist|talent|academic|other",
      "email": null,
      "linkedin_url": null,
      "github_url": null,
      "twitter_url": null,
      "instagram_url": null,
      "tiktok_url": null,
      "youtube_url": null,
      "website_url": null,
      "avatar_url": null,
      "source_url": "the URL this person was found on",
      "followers": 0,
      "bio": "1-2 sentence background",
      "ai_summary": "2-3 sentence summary highlighting why they match the search",
      "skills": ["relevant skills, niches or content verticals"],
      "experience": [
        {"company": "...", "title": "...", "start": "YYYY", "end": "YYYY or Present"}
      ]
    }
  ]
}

Hard rules:
- Only include real, named individuals. SKIP company-only pages, generic
  articles, job posts, and listicles with no people.
- Do NOT fabricate emails or URLs. Use null when not present.
- Return up to 25 profiles. Prefer more over fewer when signal is strong.
- Favor LinkedIn, GitHub, Twitter/X, TikTok, Instagram, YouTube, personal
  websites and team pages.
- Populate `followers` as an integer if the source mentions it; else null.
- If you can infer an avatar (e.g. visible image URL), fill `avatar_url`.
- Keep `ai_summary` concise and focused on the search criteria.
"""


def _extract_profiles(text: str) -> list[dict[str, Any]]:
    """Best-effort JSON extractor tolerant to minor LLM formatting drift."""
    try:
        data = json.loads(text)
        if isinstance(data, dict) and isinstance(data.get("profiles"), list):
            return data["profiles"]
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    m = re.search(r"\[.*\]", text, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, dict) and isinstance(data.get("profiles"), list):
                return data["profiles"]
        except json.JSONDecodeError:
            pass

    return []


def _tavily_search(query: str) -> list[dict[str, Any]]:
    """Execute a single Tavily search. Safe for thread execution."""
    try:
        resp = _get_tavily().search(
            query=query,
            max_results=MAX_RESULTS_PER_QUERY,
            search_depth="advanced",
            include_answer=False,
            include_images=False,
        )
        return resp.get("results", []) or []
    except Exception as exc:
        logger.warning("Tavily query '%s' failed: %s", query, exc)
        return []


async def _run_all_searches(queries: list[str]) -> list[dict[str, Any]]:
    """Run all Tavily queries in parallel threads."""
    tasks = [asyncio.to_thread(_tavily_search, q) for q in queries]
    results_per_query = await asyncio.gather(*tasks, return_exceptions=False)
    merged: list[dict[str, Any]] = []
    for chunk in results_per_query:
        merged.extend(chunk)
    return merged


async def search_node(state: NexusState) -> NexusState:
    """Searches Tavily across platforms and extracts structured profiles."""
    queries_all = state.get("search_queries", []) or []
    queries = [q for q in queries_all if isinstance(q, str) and q.strip()][:MAX_QUERIES]

    events = [
        {
            "type": "searching",
            "message": (
                f"I'm live-searching the open web now — {len(queries)} focused passes "
                "across the platforms in your plan."
            ),
            "data": {"query_count": len(queries)},
        }
    ]

    if not queries:
        return {"raw_results": [], "status": "ranking", "events": events}

    raw_sources = await _run_all_searches(queries)

    # Deduplicate sources by URL to avoid feeding the LLM duplicates.
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for r in raw_sources:
        url = (r.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        deduped.append(r)

    events.append(
        {
            "type": "found",
            "message": (
                f"Pulled {len(deduped)} solid sources — now extracting named people and "
                "their socials into structured rows."
            ),
            "data": {"source_count": len(deduped)},
        }
    )

    if not deduped:
        return {"raw_results": [], "status": "ranking", "events": events}

    combined = "\n\n---\n\n".join(
        f"URL: {r.get('url')}\nTITLE: {r.get('title')}\nCONTENT:\n"
        f"{(r.get('content', '') or '')[:MAX_CONTENT_CHARS]}"
        for r in deduped[:MAX_SOURCES_TO_LLM]
    )

    try:
        text = llm_chat(
            system=EXTRACT_PROMPT,
            user=(
                f"Search criteria: {json.dumps(state.get('criteria', {}))}\n\n"
                f"Raw search results:\n{combined}"
            ),
            tier="reasoning",
            max_tokens=6000,
            temperature=0.1,
            json_response=True,
        )
        profiles = _extract_profiles(text)
    except Exception as exc:
        logger.exception("Profile extraction failed")
        events.append({"type": "error", "message": f"Profile extraction failed: {exc}"})
        return {"raw_results": [], "status": "ranking", "events": events, "error": str(exc)}

    # Deduplicate by (name lowercase, any social URL) — creators often show up
    # on multiple platforms and we only want one row per person.
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for p in profiles:
        if not isinstance(p, dict):
            continue
        name = (p.get("name") or "").strip().lower()
        if not name:
            continue
        social_key = next(
            (
                (p.get(f) or "").strip().lower()
                for f in (
                    "linkedin_url",
                    "twitter_url",
                    "instagram_url",
                    "tiktok_url",
                    "youtube_url",
                    "github_url",
                    "website_url",
                )
                if p.get(f)
            ),
            "",
        )
        key = f"{name}|{social_key}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)

    return {"raw_results": unique, "status": "ranking", "events": events}
