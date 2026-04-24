"""Search agent — Tavily + optional Apollo + optional Scrupp (Apollo via Scrupp), then LLM extract.

1. Runs Tavily in parallel with optional direct Apollo People API and optional
   Scrupp ``/apollo/search`` export (when ``SCRUPP_API_KEY`` and linked-account
   ``SCRUPP_APOLLO_ACCOUNT`` / ``APOLLO_LOGIN_EMAIL`` are set — uses an Apollo hash URL).
2. Feeds deduped Tavily pages to the LLM to extract profiles.
3. Merges directory/export rows after extraction (deduped by name / social URL).
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
from app.services.apollo_people import search_people as apollo_search_people
from app.services.llm import llm_chat
from app.services.scrupp_apollo import (
    export_people_via_scrupp,
    scrupp_apollo_export_configured,
)

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


def _try_add_profile(
    bucket: list[dict[str, Any]],
    seen: set[str],
    p: dict[str, Any],
) -> None:
    """Append one profile if name is present and dedupe key is new."""
    if not isinstance(p, dict):
        return
    name = (p.get("name") or "").strip().lower()
    if not name:
        return
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
        return
    seen.add(key)
    bucket.append(p)


async def search_node(state: NexusState) -> NexusState:
    """Searches Tavily across platforms and extracts structured profiles."""
    queries_all = state.get("search_queries", []) or []
    queries = [q for q in queries_all if isinstance(q, str) and q.strip()][:MAX_QUERIES]

    use_apollo = bool((settings.APOLLO_API_KEY or "").strip())
    use_scrupp = scrupp_apollo_export_configured()
    extra = []
    if use_apollo:
        extra.append("direct Apollo people API")
    if use_scrupp:
        extra.append("Scrupp Apollo export")
    extra_txt = f" Also running in parallel: {', '.join(extra)}." if extra else ""
    events = [
        {
            "type": "searching",
            "message": (
                f"I'm live-searching the open web now — {len(queries)} focused passes "
                "across the platforms in your plan."
                + extra_txt
            ),
            "data": {
                "query_count": len(queries),
                "apollo": use_apollo,
                "scrupp": use_scrupp,
            },
        }
    ]

    if not queries:
        return {"raw_results": [], "status": "ranking", "events": events}

    criteria = state.get("criteria", {}) or {}

    async def _apollo_branch() -> list[dict[str, Any]]:
        if not use_apollo:
            return []
        try:
            return await apollo_search_people(criteria, queries)
        except Exception as exc:
            logger.warning("Apollo parallel search failed: %s", exc)
            return []

    async def _scrupp_branch() -> list[dict[str, Any]]:
        if not use_scrupp:
            return []
        try:
            return await export_people_via_scrupp(criteria)
        except Exception as exc:
            logger.warning("Scrupp Apollo export failed: %s", exc)
            return []

    raw_sources, apollo_profiles, scrupp_profiles = await asyncio.gather(
        _run_all_searches(queries),
        _apollo_branch(),
        _scrupp_branch(),
    )

    apollo_n = len(apollo_profiles) if isinstance(apollo_profiles, list) else 0
    scrupp_n = len(scrupp_profiles) if isinstance(scrupp_profiles, list) else 0
    if use_apollo:
        events.append(
            {
                "type": "searching",
                "message": (
                    "Apollo People Search: queried the Apollo people directory in parallel "
                    f"({apollo_n} people returned). "
                    "These merge after the web pass; rows that match the same person as a "
                    "web result are deduplicated."
                ),
                "data": {
                    "source": "apollo",
                    "apollo_people_returned": apollo_n,
                },
            }
        )

    if use_scrupp:
        events.append(
            {
                "type": "searching",
                "message": (
                    "Scrupp (Apollo export): finished an Apollo people-list export via Scrupp "
                    f"({scrupp_n} profile rows). "
                    "These merge after the web pass like other directory results."
                ),
                "data": {"source": "scrupp", "scrupp_rows": scrupp_n},
            }
        )

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
                f"Pulled {len(deduped)} solid web sources"
                + (
                    f" (Apollo API: {apollo_n} directory rows — see note above)"
                    if use_apollo
                    else ""
                )
                + (
                    f" (Scrupp export: {scrupp_n} rows — see note above)"
                    if use_scrupp
                    else ""
                )
                + " — now extracting named people and their socials into structured rows."
            ),
            "data": {
                "source_count": len(deduped),
                "apollo_people_count": apollo_n,
                "scrupp_rows": scrupp_n,
            },
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
        _try_add_profile(unique, seen, p)

    n_after_web_extract = len(unique)
    if isinstance(apollo_profiles, list):
        for p in apollo_profiles:
            _try_add_profile(unique, seen, p)

    n_after_apollo = len(unique)
    if isinstance(scrupp_profiles, list):
        for p in scrupp_profiles:
            _try_add_profile(unique, seen, p)

    if use_apollo:
        apollo_new = len(unique) - n_after_web_extract
        dup = max(0, apollo_n - apollo_new)
        events.append(
            {
                "type": "searching",
                "message": (
                    f"Apollo merge: {apollo_new} new row(s) added from the directory "
                    f"({dup} overlapped people we already had from the web extraction)."
                    if apollo_n
                    else (
                        "Apollo merge: directory returned 0 people for this filter set — "
                        "check server logs, widen criteria, or confirm the API key has "
                        "People Search access."
                    )
                ),
                "data": {
                    "source": "apollo_merge",
                    "apollo_returned": apollo_n,
                    "apollo_new_rows": apollo_new if apollo_n else 0,
                },
            }
        )

    if use_scrupp:
        scrupp_new = len(unique) - n_after_apollo
        scrupp_dup = max(0, scrupp_n - scrupp_new)
        events.append(
            {
                "type": "searching",
                "message": (
                    f"Scrupp merge: {scrupp_new} new row(s) from the export "
                    f"({scrupp_dup} overlapped existing web or Apollo rows)."
                    if scrupp_n
                    else (
                        "Scrupp merge: export returned 0 rows — check Scrupp credits, "
                        "Apollo URL filters, or Scrupp API logs."
                    )
                ),
                "data": {
                    "source": "scrupp_merge",
                    "scrupp_returned": scrupp_n,
                    "scrupp_new_rows": scrupp_new if scrupp_n else 0,
                },
            }
        )

    return {"raw_results": unique, "status": "ranking", "events": events}
