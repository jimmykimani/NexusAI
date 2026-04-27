"""Session display titles — from structured criteria when available, else cleaned query."""
from __future__ import annotations

import re
from typing import Any

# Strip common polite / wrapper phrases from the raw user query for sidebar titles.
_QUERY_WRAPPER = re.compile(
    r"^\s*(please\s+)?"
    r"(i\s*'?m\s+looking\s+for\s+|i\s+need\s+|i\s+want\s+|we\s+need\s+|we\s*'?re\s+looking\s+for\s+)?"
    r"(can\s+you\s+|could\s+you\s+)?(find(\s+me)?\s+|search\s+for\s+|look\s+for\s+)?",
    re.I,
)


def title_from_query(q: str, max_len: int = 60) -> str:
    """Trim and lightly normalize the user query for an initial session title."""
    raw = (q or "").strip()
    if not raw:
        return "Search"
    stripped = _QUERY_WRAPPER.sub("", raw).strip()
    q = stripped if stripped else raw
    q = q.strip().rstrip("?.!")
    if len(q) <= max_len:
        return q or "Search"
    return q[: max_len - 1].rsplit(" ", 1)[0] + "…"


def title_from_criteria(criteria: dict[str, Any], original_query: str, max_len: int = 60) -> str:
    """Build a short title from supervisor criteria (roles, niche, location)."""
    roles = criteria.get("roles") if isinstance(criteria.get("roles"), list) else []
    role_bits: list[str] = []
    for r in roles[:3]:
        s = str(r).strip()
        if s and s not in role_bits:
            role_bits.append(s)
    industry = str(criteria.get("industry") or "").strip()
    location = str(criteria.get("location") or "").strip()
    person_type = str(criteria.get("person_type") or "").strip()

    parts: list[str] = []
    if role_bits:
        parts.append(", ".join(role_bits))
    elif industry:
        parts.append(industry)
    elif person_type and person_type != "other":
        parts.append(person_type.replace("_", " ").title())

    if industry and industry not in (parts[0] if parts else ""):
        parts.append(industry)
    if location:
        parts.append(location)

    if not parts:
        return title_from_query(original_query, max_len=max_len)

    title = " · ".join(parts)
    if len(title) > max_len:
        title = title[: max_len - 1].rsplit(" ", 1)[0] + "…"
    return title
