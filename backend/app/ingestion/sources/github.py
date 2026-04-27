"""GitHub API people search — free, 5,000 req/hour authenticated.

Best for: finding developers, AI researchers, OSS contributors.
Returns structured profiles compatible with the NexusAI lead schema.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def github_available() -> bool:
    """Return True if a GitHub token is configured."""
    return bool((settings.GITHUB_TOKEN or "").strip())


async def search_github_users(criteria: dict[str, Any]) -> list[dict[str, Any]]:
    """Search GitHub for people matching criteria. Free, 5k req/hour.

    Args:
        criteria: Search criteria dict with keys like location, keywords, roles.

    Returns:
        List of profile dicts compatible with the lead schema.
    """
    if not github_available():
        logger.debug("github_search_skipped: no GITHUB_TOKEN configured")
        return []

    location = criteria.get("location", "")
    keywords = " ".join(criteria.get("keywords", []) or [])
    roles = " ".join(criteria.get("roles", []) or [])

    query_parts = []
    if keywords:
        query_parts.append(keywords)
    if roles:
        query_parts.append(roles)
    if location:
        query_parts.append(f"location:{location}")

    query = " ".join(query_parts).strip()
    if not query:
        return []

    headers = {
        "Accept": "application/vnd.github.v3+json",
    }
    token = (settings.GITHUB_TOKEN or "").strip()
    if token:
        headers["Authorization"] = f"token {token}"

    profiles: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Search users
            r = await client.get(
                f"{GITHUB_API}/search/users",
                params={"q": query, "per_page": 10, "sort": "followers"},
                headers=headers,
            )
            if r.status_code != 200:
                logger.warning(
                    "github_search_failed",
                    extra={"status": r.status_code, "query": query[:80]},
                )
                return []

            users = r.json().get("items", [])

            # Step 2: Enrich top 5 with full profiles (rate limit aware)
            for user in users[:5]:
                try:
                    detail_resp = await client.get(
                        f"{GITHUB_API}/users/{user['login']}",
                        headers=headers,
                    )
                    if detail_resp.status_code != 200:
                        continue
                    d = detail_resp.json()

                    profiles.append({
                        "name": d.get("name") or d["login"],
                        "title": "Software Engineer",  # GitHub doesn't expose titles
                        "company": (d.get("company") or "").lstrip("@"),
                        "location": d.get("location", ""),
                        "bio": d.get("bio", ""),
                        "github_url": d["html_url"],
                        "website_url": d.get("blog", ""),
                        "followers": d.get("followers", 0),
                        "avatar_url": d.get("avatar_url", ""),
                        "skills": [],  # enriched downstream by extraction agent
                        "source": "github",
                        "source_id": str(d["id"]),
                    })
                except Exception:
                    continue

    except httpx.TimeoutException:
        logger.warning("github_search_timeout", extra={"query": query[:80]})
    except Exception as exc:
        logger.warning("github_search_error", extra={"error": str(exc)})

    logger.info(
        "github_search_complete",
        extra={"query": query[:80], "results": len(profiles)},
    )
    return profiles
