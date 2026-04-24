"""Scrupp — export Apollo people lists via Scrupp when direct Apollo API is unavailable.

Docs: https://scrupp.com/docs/api/apollo — POST ``/apollo/search`` with an Apollo People
URL (hash filters), then poll ``GET /task/{process_id}/data``. Prefer
``Authorization: Bearer``; fall back to ``?api_key=`` on auth failure.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SCRUPP_BASE = "https://api.scrupp.com/api/v1"
POLL_INTERVAL_S = 2.0
POLL_MAX_ATTEMPTS = 45
REQUEST_TIMEOUT = 60.0
EXPORT_MAX = 28


def _apollo_people_url(criteria: dict[str, Any]) -> str:
    """Build an ``app.apollo.io`` people hash URL from supervisor criteria."""
    pairs: list[tuple[str, str]] = [
        ("page", "1"),
        ("sortAscending", "false"),
        ("sortByField", "[none]"),
    ]
    roles = criteria.get("roles") or []
    if isinstance(roles, list):
        for r in roles[:6]:
            if isinstance(r, str) and r.strip():
                pairs.append(("personTitles[]", r.strip()))
    loc = (criteria.get("location") or "").strip()
    if loc:
        pairs.append(("personLocations[]", loc[:120]))
    kw_bits: list[str] = []
    keywords = criteria.get("keywords") or []
    if isinstance(keywords, list):
        kw_bits.extend(str(k).strip() for k in keywords[:8] if k)
    industry = (criteria.get("industry") or "").strip()
    if industry:
        kw_bits.append(industry)
    if kw_bits:
        pairs.append(("q_keywords", " ".join(dict.fromkeys(kw_bits))[:200]))
    qs = urlencode(pairs, doseq=True)
    return f"https://app.apollo.io/#/people?{qs}"


def _scrupp_row_to_profile(row: dict[str, Any]) -> dict[str, Any] | None:
    name = (row.get("name") or "").strip()
    if not name:
        return None

    title = (row.get("position") or row.get("title") or "").strip() or None
    company = (row.get("company_name") or row.get("company") or "").strip() or None
    location = (row.get("location") or "").strip() or None
    linkedin = (row.get("linkedin_url") or "").strip() or None
    if linkedin and not linkedin.startswith("http"):
        linkedin = f"https://{linkedin.lstrip('/')}"

    email: str | None = None
    raw_emails = row.get("emails")
    if isinstance(raw_emails, list) and raw_emails:
        first = raw_emails[0]
        if isinstance(first, str):
            email = first.strip() or None
        elif isinstance(first, dict):
            email = (first.get("email") or first.get("address") or "").strip() or None
    if not email:
        email = (row.get("email") or "").strip() or None

    domain = (row.get("company_domain") or "").strip() or None
    website = f"https://{domain}" if domain and "." in domain else None

    return {
        "name": name,
        "title": title,
        "headline": title,
        "company": company,
        "location": location,
        "country_code": None,
        "person_type": "executive",
        "email": email,
        "linkedin_url": linkedin,
        "github_url": None,
        "twitter_url": None,
        "instagram_url": None,
        "tiktok_url": None,
        "youtube_url": None,
        "website_url": website,
        "avatar_url": None,
        "source_url": linkedin or website,
        "followers": None,
        "bio": " · ".join(x for x in (title, company, location) if x) or None,
        "ai_summary": (
            "Lead from Scrupp Apollo export (Apollo UI filters applied via URL). "
            "Email/phone fields depend on Scrupp export availability."
        ),
        "skills": [],
        "experience": [],
    }


def _auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _scrupp_query_auth(api_key: str) -> dict[str, str]:
    """Scrupp still documents ``api_key`` query auth; ping validates with query only."""
    return {"api_key": api_key}


def _effective_apollo_account_for_scrupp() -> str:
    """Value for Scrupp JSON ``account`` (linked Apollo in Scrupp — not the Apollo API key)."""
    for raw in (
        settings.SCRUPP_APOLLO_ACCOUNT,
        settings.APOLLO_LOGIN_EMAIL,
    ):
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return ""


def scrupp_apollo_export_configured() -> bool:
    """True when Scrupp key and Apollo account slug/email are both present."""
    return bool((settings.SCRUPP_API_KEY or "").strip()) and bool(
        _effective_apollo_account_for_scrupp()
    )


async def export_people_via_scrupp(
    criteria: dict[str, Any],
) -> list[dict[str, Any]]:
    """Run Scrupp Apollo people export; return Nexus-shaped profile dicts."""
    key = (settings.SCRUPP_API_KEY or "").strip()
    if not key:
        return []

    acct = _effective_apollo_account_for_scrupp()
    if not acct:
        logger.warning(
            "Scrupp Apollo export skipped: set SCRUPP_APOLLO_ACCOUNT (or APOLLO_LOGIN_EMAIL) "
            "to the Apollo account identifier shown in Scrupp after linking Apollo — not APOLLO_KEY."
        )
        return []

    apollo_url = _apollo_people_url(criteria)
    payload: dict[str, Any] = {
        "url": apollo_url,
        "with_emails": True,
        "max": EXPORT_MAX,
        "page": 1,
        "account": acct,
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            # Prefer documented query auth (matches /ping); retry Bearer on 401/403.
            post = await client.post(
                f"{SCRUPP_BASE}/apollo/search",
                params=_scrupp_query_auth(key),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                json=payload,
            )
            if post.status_code in (401, 403):
                post = await client.post(
                    f"{SCRUPP_BASE}/apollo/search",
                    headers=_auth_headers(key),
                    json=payload,
                )
            post.raise_for_status()
            start = post.json()
    except httpx.HTTPStatusError as exc:
        body = (exc.response.text or "")[:600]
        logger.warning(
            "Scrupp Apollo search HTTP %s: %s",
            exc.response.status_code,
            body,
        )
        if exc.response.status_code >= 500:
            logger.warning(
                "Scrupp returned 5xx — if ``account`` is wrong (e.g. Apollo API key), "
                "use the linked-account value from Scrupp, not APOLLO_KEY."
            )
        return []
    except Exception as exc:
        logger.warning("Scrupp Apollo search failed: %s", exc)
        return []

    process_id = start.get("process_id") if isinstance(start, dict) else None
    if process_id is None:
        logger.warning("Scrupp Apollo search: no process_id in %s", start)
        return []

    items: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for attempt in range(POLL_MAX_ATTEMPTS):
                await asyncio.sleep(POLL_INTERVAL_S if attempt else 0.5)
                pid = str(process_id)
                gr = await client.get(
                    f"{SCRUPP_BASE}/task/{pid}/data",
                    params=_scrupp_query_auth(key),
                    headers={"Accept": "application/json"},
                )
                if gr.status_code in (401, 403):
                    gr = await client.get(
                        f"{SCRUPP_BASE}/task/{pid}/data",
                        headers=_auth_headers(key),
                    )
                if gr.status_code == 404:
                    continue
                gr.raise_for_status()
                data = gr.json()
                if not isinstance(data, dict):
                    continue
                raw_items = data.get("items")
                if isinstance(raw_items, list) and len(raw_items) > 0:
                    items = raw_items
                    break
                total = data.get("total")
                if isinstance(total, int) and total == 0 and attempt > 3:
                    break
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Scrupp task %s HTTP %s: %s",
            process_id,
            exc.response.status_code,
            exc.response.text[:500],
        )
    except Exception as exc:
        logger.warning("Scrupp task %s poll failed: %s", process_id, exc)

    out: list[dict[str, Any]] = []
    for row in items:
        if isinstance(row, dict):
            p = _scrupp_row_to_profile(row)
            if p:
                out.append(p)
    logger.info("Scrupp Apollo export process_id=%s -> %d profiles", process_id, len(out))
    return out
