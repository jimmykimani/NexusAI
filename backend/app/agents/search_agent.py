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
from app.agents.state import NexusState
from app.core.config import settings
from app.services.llm import llm_chat
from app.services import cache
from app.core.prompts import load_prompt

logger = logging.getLogger(__name__)


def get_extraction_prompt() -> str:
    return load_prompt("extraction", "v1")

_tavily: TavilyClient | None = None
_tavily_disabled_reason: str | None = None

# Caps kept high but finite so we never blow LLM context.
MAX_QUERIES = 4
MAX_RESULTS_PER_QUERY = 10
MAX_SOURCES_TO_LLM = 25
MAX_CONTENT_CHARS = 900


def _get_tavily() -> TavilyClient:
    """Lazily initialize the Tavily client."""
    global _tavily
    if _tavily is None:
        if not settings.TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY is not set.")
        _tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)
    return _tavily





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


def _is_provider_blocking_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(
        token in text
        for token in (" 401", " 403", " 429", " 432", "unauthorized", "forbidden", "api_key", "not set")
    )


def _tavily_search(query: str, events: list[dict[str, Any]] | None = None) -> tuple[list[dict[str, Any]], bool]:
    """Single Tavily query; returns (results, fatal_indicator)."""
    global _tavily_disabled_reason
    if _tavily_disabled_reason:
        return [], True

    cached = cache.get("tavily", query)
    if cached:
        logger.info("Tavily cache hit for query: %r", query)
        return cached, False

    try:
        resp = _get_tavily().search(
            query=query,
            max_results=MAX_RESULTS_PER_QUERY,
            search_depth="basic",
            include_answer=False,
            include_images=False,
            include_content=False,
        )
        data = resp.get("results", []) or []
        cache.set("tavily", query, data)
        return data, False
    except Exception as exc:
        if _is_provider_blocking_error(exc):
            _tavily_disabled_reason = str(exc)
        
        logger.warning("Tavily query %r failed: %s", query, exc)
        return [], bool(_tavily_disabled_reason)


def _serper_search(query: str) -> list[dict[str, Any]]:
    """Single Serper (Google) query; returns results list."""
    try:
        from app.services.serper_search import _serper_search_sync
        return _serper_search_sync(query, num_results=MAX_RESULTS_PER_QUERY)
    except Exception as exc:
        logger.warning("Serper query %r failed: %s", query, exc)
        return []


def _web_search(query: str, events: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Run both Tavily AND Serper in parallel, merge and dedupe by URL."""
    from app.services.serper_search import serper_available

    tavily_results, _ = _tavily_search(query, events)
    serper_results: list[dict[str, Any]] = []
    if serper_available():
        serper_results = _serper_search(query)

    # Merge and deduplicate by URL.
    seen_urls: set[str] = set()
    merged: list[dict[str, Any]] = []
    for r in tavily_results + serper_results:
        url = (r.get("url") or "").strip().rstrip("/").lower()
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)
        merged.append(r)

    if not merged and events is not None:
        events.append({
            "type": "searching",
            "message": f"No web results found for: {query[:60]}",
        })

    return merged


async def _run_all_searches(queries: list[str], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run web searches across all queries using both Tavily + Serper."""
    if not queries:
        return []

    # Fan out all queries in parallel.
    tasks = [asyncio.to_thread(_web_search, q, events) for q in queries]
    results_per_query = await asyncio.gather(*tasks, return_exceptions=False)
    
    merged: list[dict[str, Any]] = []
    for chunk in results_per_query:
        if isinstance(chunk, list):
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

    events = [
        {
            "type": "searching",
            "message": (
                f"I'm live-searching the open web now — {len(queries)} focused passes "
                "across the platforms in your plan."
            ),
            "data": {
                "query_count": len(queries),
            },
        }
    ]

    if not queries:
        return {"raw_results": [], "status": "ranking", "events": events}

    criteria = state.get("criteria", {}) or {}

    raw_sources = await _run_all_searches(queries, events)

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
                f"Pulled {len(deduped)} solid web sources — now extracting named people and their socials into structured rows."
            ),
            "data": {
                "source_count": len(deduped),
            },
        }
    )

    if not deduped:
        return {"raw_results": [], "status": "ranking", "events": events}

    combined = "\n\n---\n\n".join(
        f"URL: {r.get('url')}\nTITLE: {r.get('title')}\nCONTENT:\n"
        f"{(r.get('content') or r.get('snippet') or '')[:MAX_CONTENT_CHARS]}"
        for r in deduped[:MAX_SOURCES_TO_LLM]
    )

    try:
        text = llm_chat(
            system=get_extraction_prompt(),
            user=(
                f"Search criteria: {json.dumps(state.get('criteria', {}))}\n\n"
                f"Raw search results:\n{combined}"
            ),
            tier="fast",
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

    # Ensure all have a default match_status so partitionLeads doesn't choke
    for p in unique:
        if "match_status" not in p:
            p["match_status"] = "partially_matched"
        if "match_score" not in p:
            p["match_score"] = 0.0

    events.append(
        {
            "type": "found",
            "message": f"Extracted {len(unique)} candidate profiles — now ranking for best fit.",
            "data": {"leads": unique},
        }
    )

    return {"raw_results": unique, "status": "ranking", "events": events}
