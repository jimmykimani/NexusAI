#!/usr/bin/env python3
"""
Smoke-test Tavily + optional Apollo + Scrupp with **zero LLM calls**.

Run from the backend directory (so ``.env`` loads):

  cd backend && .venv/bin/python scripts/smoke_search_no_llm.py
  cd backend && .venv/bin/python scripts/smoke_search_no_llm.py "product managers London"

Uses one short web query for Tavily, and light criteria for Apollo/Scrupp.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path


def _bootstrap() -> None:
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    import app.langchain_compat  # noqa: F401
    import importlib

    # Ensure ``.env`` is read from this directory (reload if config was imported earlier).
    if "app.core.config" in sys.modules:
        importlib.reload(sys.modules["app.core.config"])
    else:
        import app.core.config  # noqa: F401


async def _run(query: str) -> None:
    from app.agents.search_agent import _run_all_searches
    from app.core.config import settings
    from app.services.apollo_people import search_people
    from app.services.clay_client import check_clay_api_key
    from app.services.scrupp_apollo import (
        export_people_via_scrupp,
        scrupp_apollo_export_configured,
    )

    queries = [query.strip()[:240] or "AI engineers Nairobi Kenya"]
    # Minimal criteria for directory/export APIs (not used by Tavily).
    criteria: dict = {
        "roles": ["Engineer"],
        "location": "Nairobi, Kenya",
        "industry": "Software",
        "seniority": "unspecified",
        "keywords": queries[0].replace("site:", "").split()[:10],
    }

    # Print first so stderr logs from HTTP clients appear after this block.
    print("=== NexusAI search smoke (no LLMs) ===")
    print(f"CWD: {os.getcwd()}")
    print(f"TAVILY_API_KEY: {'set' if (settings.TAVILY_API_KEY or '').strip() else 'MISSING'}")
    print(f"APOLLO:         {'set' if (settings.APOLLO_API_KEY or '').strip() else 'off'}")
    print(f"SCRUPP:         {'set' if (settings.SCRUPP_API_KEY or '').strip() else 'off'}")
    acct_ok = bool((settings.SCRUPP_APOLLO_ACCOUNT or "").strip()) or bool(
        (settings.APOLLO_LOGIN_EMAIL or "").strip()
    )
    print(
        f"SCRUPP account: {'set' if acct_ok else 'off (set SCRUPP_APOLLO_ACCOUNT or APOLLO_LOGIN_EMAIL)'}",
    )
    print(f"CLAY:           {'set' if (settings.CLAY_API_KEY or '').strip() else 'off'}")
    print(f"Query: {queries[0]!r}")
    print()

    print("-- Tavily --")
    sources = await _run_all_searches(queries)
    print(f"results: {len(sources)}")
    for i, s in enumerate(sources[:6]):
        title = (s.get("title") or "")[:72]
        url = (s.get("url") or "")[:88]
        print(f"  {i + 1}. {title}")
        print(f"     {url}")
    print()

    print("-- Apollo (direct API) --")
    apollo = await search_people(criteria, queries)
    print(f"profiles: {len(apollo)}")
    for i, p in enumerate(apollo[:4]):
        print(f"  {i + 1}. {p.get('name')} | {(p.get('title') or '')[:48]}")
    print()

    print("-- Scrupp (Apollo export) --")
    if not scrupp_apollo_export_configured():
        scrupp = []
        print(
            "skipped: add SCRUPP_APOLLO_ACCOUNT or APOLLO_LOGIN_EMAIL "
            "(Scrupp linked Apollo id — not APOLLO_KEY).",
        )
    else:
        scrupp = await export_people_via_scrupp(criteria)
    print(f"profiles: {len(scrupp)}")
    for i, p in enumerate(scrupp[:4]):
        em = (p.get("email") or "")[:32]
        print(
            f"  {i + 1}. {p.get('name')} | {(p.get('title') or '')[:40]} | email={em or '—'}",
        )
    print()

    print("-- Clay (API reachability) --")
    clay = await check_clay_api_key()
    print(f"ok: {clay.get('ok')} — {clay.get('detail', '')}")
    if clay.get("http_status"):
        print(f"HTTP {clay['http_status']}")
    ex = (clay.get("response_excerpt") or "").strip()
    if ex:
        print(f"excerpt: {ex[:200]}")
    print()

    print("Done (no supervisor, extraction, or ranking LLM).")


def main() -> None:
    p = argparse.ArgumentParser(description="Tavily + Apollo + Scrupp smoke test without LLMs.")
    p.add_argument(
        "query",
        nargs="?",
        default="AI engineers Nairobi Kenya site:linkedin.com/in",
        help="Single Tavily query string",
    )
    args = p.parse_args()
    _bootstrap()
    asyncio.run(_run(args.query))


if __name__ == "__main__":
    main()
