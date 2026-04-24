"""Minimal Clay HTTP checks (https://api.clay.com).

The key under Clay Settings → Account is often **not** the same as a workspace admin
token accepted by ``/v3/me``; this module reports what we can verify without
consuming enrichment credits.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

CLAY_API_ROOT = "https://api.clay.com"
REQUEST_TIMEOUT = 20.0


async def check_clay_api_key() -> dict[str, Any]:
    """Return a small status dict for diagnostics (no secrets)."""
    key = (settings.CLAY_API_KEY or "").strip()
    if not key:
        return {"ok": False, "detail": "CLAY_API_KEY is not set."}

    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            r = await client.get(f"{CLAY_API_ROOT}/v3/me", headers=headers)
    except Exception as exc:
        logger.warning("Clay API reachability check failed: %s", exc)
        return {"ok": False, "detail": f"Request failed: {exc!r}"}

    if r.status_code == 200:
        return {"ok": True, "detail": "Authenticated to Clay API (GET /v3/me)."}

    snippet = (r.text or "")[:200].replace("\n", " ")
    if r.status_code == 401:
        return {
            "ok": False,
            "http_status": 401,
            "detail": (
                "Key is not accepted as Bearer for GET /v3/me (workspace session). "
                "If this is the short key from Settings → Account, it may be for "
                "in-product features only; use a Clay workspace/API token if you need "
                "REST access, or keep Clay for outbound enrichments from Clay tables."
            ),
            "response_excerpt": snippet,
        }

    return {
        "ok": False,
        "http_status": r.status_code,
        "detail": "Unexpected response from Clay API.",
        "response_excerpt": snippet,
    }
