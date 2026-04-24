"""Apollo.io People API Search — optional B2B-style enrichment alongside Tavily.

Uses POST ``/mixed_people/api_search`` (master API key). Does not return emails;
those require separate enrichment endpoints. When ``APOLLO_API_KEY`` is set,
results are merged into the same profile shape as the Tavily extraction step.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

APOLLO_BASE = "https://api.apollo.io/api/v1/mixed_people/api_search"
DEFAULT_PER_PAGE = 28
REQUEST_TIMEOUT = 45.0


def _iso2_country(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    s = raw.strip().upper()
    return s if len(s) == 2 else None


# Map supervisor seniority hints to Apollo ``person_seniorities[]`` tokens.
_SENIORITY_TO_APOLLO: dict[str, list[str]] = {
    "junior": ["entry", "intern"],
    "mid": ["manager", "senior"],
    "senior": ["senior", "head", "director"],
    "executive": ["director", "vp", "head", "c_suite", "founder", "owner", "partner"],
    "celebrity": ["c_suite", "founder", "owner"],
    "unspecified": [],
}


def _build_search_params(criteria: dict[str, Any], queries: list[str]) -> list[tuple[str, str]]:
    """Flatten criteria + queries into Apollo query-string tuples."""
    pairs: list[tuple[str, str]] = [
        ("per_page", str(min(DEFAULT_PER_PAGE, 100))),
        ("page", "1"),
        ("include_similar_titles", "true"),
    ]

    roles = criteria.get("roles") or []
    if isinstance(roles, list):
        for r in roles[:8]:
            if isinstance(r, str) and r.strip():
                pairs.append(("person_titles[]", r.strip()))

    loc = (criteria.get("location") or "").strip()
    if loc:
        # Apollo accepts city / region / country strings.
        pairs.append(("person_locations[]", loc[:120]))

    keywords = criteria.get("keywords") or []
    kw_parts: list[str] = []
    if isinstance(keywords, list):
        kw_parts.extend(str(k).strip() for k in keywords[:12] if k)
    industry = (criteria.get("industry") or "").strip()
    if industry:
        kw_parts.append(industry)
    if queries:
        # Light signal from the first web query (strip common operators).
        q0 = queries[0].replace("site:", " ").strip()
        if len(q0) > 12:
            kw_parts.append(q0[:160])

    q_keywords = " ".join(dict.fromkeys(kw_parts))  # de-dupe preserving order
    if q_keywords.strip():
        pairs.append(("q_keywords", q_keywords.strip()[:200]))

    seniority = (criteria.get("seniority") or "unspecified").strip().lower()
    for s in _SENIORITY_TO_APOLLO.get(seniority, []):
        pairs.append(("person_seniorities[]", s))

    return pairs


def _apollo_person_to_profile(p: dict[str, Any]) -> dict[str, Any] | None:
    """Map one Apollo ``people`` record to NexusAI extraction profile shape."""
    fn = (p.get("first_name") or "").strip()
    ln = (p.get("last_name") or "").strip()
    name = f"{fn} {ln}".strip()
    if not name:
        raw = (p.get("name") or "").strip()
        name = raw if raw else ""
    if not name:
        return None

    org = p.get("organization") or {}
    company: str | None = None
    if isinstance(org, dict):
        company = org.get("name") or org.get("primary_domain")
    company = company or p.get("organization_name")
    if company is not None:
        company = str(company).strip() or None

    title = (p.get("title") or "").strip() or None
    headline = (p.get("headline") or title or "").strip() or None

    parts = [p.get("city"), p.get("state"), p.get("country")]
    location = ", ".join(str(x).strip() for x in parts if x and str(x).strip()) or None

    linkedin = p.get("linkedin_url") or p.get("linkedin_url_unrolled")
    if linkedin:
        linkedin = str(linkedin).strip()
        if linkedin and not linkedin.startswith("http"):
            linkedin = f"https://{linkedin.lstrip('/')}"

    photo = (p.get("photo_url") or p.get("linkedin_profile_pic_url") or "").strip() or None

    source_url = linkedin
    if not source_url and p.get("id"):
        source_url = f"https://app.apollo.io/#/people/{p.get('id')}"

    raw_sen = str(p.get("seniority") or "").lower()
    if raw_sen in ("entry", "intern"):
        person_type = "engineer"
    elif raw_sen in ("c_suite", "founder", "owner", "vp", "director", "head", "manager", "senior", "partner"):
        person_type = "executive"
    else:
        person_type = "other"

    bio_bits = [b for b in (title, company, location) if b]
    bio = " · ".join(bio_bits) if bio_bits else None

    return {
        "name": name,
        "title": title,
        "headline": headline,
        "company": company,
        "location": location,
        "country_code": _iso2_country(p.get("country")),
        "person_type": person_type,
        "email": None,
        "linkedin_url": linkedin,
        "github_url": None,
        "twitter_url": (str(p.get("twitter_url")).strip() or None) if p.get("twitter_url") else None,
        "instagram_url": None,
        "tiktok_url": None,
        "youtube_url": None,
        "website_url": None,
        "avatar_url": photo,
        "source_url": source_url,
        "followers": None,
        "bio": bio,
        "ai_summary": (
            f"Found via Apollo People Search — {title or 'Professional'} "
            f"{'at ' + company if company else ''}. "
            "Email not included in search results; use enrichment if needed."
        ).strip(),
        "skills": [],
        "experience": [],
    }


async def search_people(
    criteria: dict[str, Any],
    queries: list[str],
) -> list[dict[str, Any]]:
    """Call Apollo mixed people search; return normalized profile dicts (may be empty)."""
    key = (settings.APOLLO_API_KEY or "").strip()
    if not key:
        return []

    params = _build_search_params(criteria, queries)
    headers = {
        "X-Api-Key": key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(APOLLO_BASE, headers=headers, params=params, json={})
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        body = exc.response.text[:800]
        try:
            err_json = exc.response.json()
            if isinstance(err_json, dict) and err_json.get("error"):
                body = str(err_json.get("error"))[:800]
        except Exception:
            pass
        logger.warning(
            "Apollo People Search HTTP %s: %s",
            exc.response.status_code,
            body,
        )
        return []
    except Exception as exc:
        logger.warning("Apollo People Search failed: %s", exc)
        return []

    people = data.get("people") if isinstance(data, dict) else None
    if not isinstance(people, list):
        return []

    out: list[dict[str, Any]] = []
    for row in people:
        if not isinstance(row, dict):
            continue
        prof = _apollo_person_to_profile(row)
        if prof:
            out.append(prof)
    logger.info("Apollo returned %d people (%d mapped)", len(people), len(out))
    return out
