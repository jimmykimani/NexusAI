"""Serper.dev Google Search — primary web search provider for NexusAI.

Uses POST ``https://google.serper.dev/search`` with a JSON body.
Returns results in the same shape as Tavily (list of dicts with url, title,
content/snippet keys) so the search agent can consume them interchangeably.

Set ``SERPER_API_KEY`` in your .env to enable.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"
REQUEST_TIMEOUT = 12.0


def serper_available() -> bool:
    """Return True if a Serper API key is configured."""
    return bool((getattr(settings, "SERPER_API_KEY", "") or "").strip())


def _serper_search_sync(query: str, num_results: int = 10) -> list[dict[str, Any]]:
    """Execute a single Serper Google search (blocking).

    Returns a list of dicts with keys: url, title, content (snippet text).
    """
    key = (settings.SERPER_API_KEY or "").strip()
    if not key:
        return []

    headers = {
        "X-API-KEY": key,
        "Content-Type": "application/json",
    }
    payload = {
        "q": query,
        "num": min(num_results, 20),
    }

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            resp = client.post(SERPER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Serper query %r failed: %s", query, exc)
        return []

    results: list[dict[str, Any]] = []

    # Serper returns organic results under "organic" key
    for item in data.get("organic", []):
        results.append({
            "url": item.get("link", ""),
            "title": item.get("title", ""),
            "content": item.get("snippet", ""),
        })

    # Also grab knowledge graph "people also search" if present
    kg = data.get("knowledgeGraph", {})
    if kg and kg.get("title"):
        results.append({
            "url": kg.get("website") or kg.get("link") or "",
            "title": kg.get("title", ""),
            "content": kg.get("description", ""),
        })

    return results
