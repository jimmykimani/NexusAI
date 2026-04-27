"""Short persona-driven copy streamed before/after the search graph runs.

Uses token streaming for OpenAI-compatible providers (openai, groq, openrouter)
when the corresponding API key is set; otherwise uses ``llm_chat`` and yields
word chunks (including all Anthropic runs).
"""
from __future__ import annotations

import asyncio
import json
from collections import Counter
import logging
from typing import Any, AsyncIterator

from app.core.config import settings
from app.services.llm import (
    llm_chat,
    openai_style_async_client,
    should_use_openai_sdk_streaming,
)
from app.services.llm_runtime import effective_model
from app.core.prompts import load_prompt

logger = logging.getLogger(__name__)


def get_intro_prompt() -> str:
    return load_prompt("intro", "v1")


def get_outro_prompt() -> str:
    return load_prompt("outro", "v1")


async def stream_intro_narrative(user_query: str) -> AsyncIterator[str]:
    """Yield streamed text tokens for the opening assistant message."""
    if not settings.ENABLE_SEARCH_NARRATION:
        return

    q = (user_query or "").strip()

    if not should_use_openai_sdk_streaming():
        text = llm_chat(
            get_intro_prompt(),
            f"User search:\n{q}",
            tier="reasoning",
            max_tokens=220,
            temperature=0.45,
        )
        async for part in _chunk_words(text):
            yield part
        return

    client = openai_style_async_client()
    try:
        stream = await client.chat.completions.create(
            model=effective_model("reasoning"),
            max_tokens=220,
            temperature=0.45,
            messages=[
                {"role": "system", "content": get_intro_prompt()},
                {"role": "user", "content": f"User search:\n{q}"},
            ],
            stream=True,
        )
        async for chunk in stream:
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                yield persona_chunk(choice.delta.content, phase="intro")
    except Exception as exc:
        logger.warning("Intro narrative stream failed: %s", exc)
        yield persona_chunk("I'll run this search across the web and line up the best matches in your results table.", phase="intro")


async def stream_outro_narrative(
    user_query: str,
    criteria: dict[str, Any],
    leads: list[dict[str, Any]],
    status: str | None,
) -> AsyncIterator[str]:
    """Yield streamed closing summary after the graph completes."""
    if not settings.ENABLE_SEARCH_NARRATION:
        return

    q = (user_query or "").strip()
    fully = sum(1 for l in leads if l.get("match_status") == "fully_matched")
    partial = len(leads) - fully
    roles = (criteria or {}).get("roles") or []
    loc = (criteria or {}).get("location") or ""
    location_mix = _top_values(leads, "location")
    company_mix = _top_values(leads, "company")

    if len(leads) == 0:
        quick_role = ", ".join(str(role).strip() for role in roles[:2] if str(role).strip())
        role_hint = quick_role or "the role"
        place_hint = f" in {loc}" if str(loc).strip() else ""
        yield (
            f"I didn’t find any strong matches for {role_hint}{place_hint} in this pass. "
            "Try widening the geography, relaxing one filter, or giving me a nearby company or title to pivot from."
        )
        return

    ctx = (
        f"User search:\n{q}\n\n"
        f"Planner notes — roles: {roles!s}, location: {loc!r}\n"
        f"Result status: {status or 'complete'}\n"
        f"Counts: {fully} fully matched (strong fit), {partial} partially matched (weaker or incomplete signal).\n"
        f"Total rows in table: {len(leads)}.\n"
        f"Top locations in results: {location_mix or 'not obvious'}.\n"
        f"Top companies or organizations: {company_mix or 'mixed set'}."
    )

    if not should_use_openai_sdk_streaming():
        text = llm_chat(
            get_outro_prompt(),
            ctx,
            tier="reasoning",
            max_tokens=320,
            temperature=0.4,
        )
        async for part in _chunk_words(text):
            yield persona_chunk(part, phase="outro")
        return

    client = openai_style_async_client()
    try:
        stream = await client.chat.completions.create(
            model=effective_model("reasoning"),
            max_tokens=320,
            temperature=0.4,
            messages=[
                {"role": "system", "content": get_outro_prompt()},
                {"role": "user", "content": ctx},
            ],
            stream=True,
        )
        async for chunk in stream:
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                yield persona_chunk(choice.delta.content, phase="outro")
    except Exception as exc:
        logger.warning("Outro narrative stream failed: %s", exc)
        yield persona_chunk("Check the results table for the best fits found during this research phase.", phase="outro")


async def stream_feedback_message(
    user_query: str,
    criteria: dict[str, Any],
    leads: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """
    Replaces generic outro narration with high-utility feedback.
    Always runs regardless of ENABLE_SEARCH_NARRATION.
    """
    q = (user_query or "").strip()
    fully = sum(1 for l in leads if l.get("match_status") == "fully_matched")
    partial = len(leads) - fully
    
    sample_leads = [
        {"name": l.get("name"), "title": l.get("title"), "company": l.get("company")}
        for l in leads[:4]
    ]
    
    prompt = load_prompt(
        "feedback", "v1",
        query=q,
        fully_matched=fully,
        partial=partial,
        sample=json.dumps(sample_leads),
        criteria=json.dumps(criteria or {}),
    )
    
    if not should_use_openai_sdk_streaming():
        text = llm_chat(
            prompt,
            "Synthesize search feedback.",
            tier="fast",
            max_tokens=350,
            temperature=0.3,
        )
        async for part in _chunk_words(text):
            yield persona_chunk(part, phase="outro")
        return

    client = openai_style_async_client()
    try:
        stream = await client.chat.completions.create(
            model=effective_model("fast"),
            max_tokens=350,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        async for chunk in stream:
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                yield persona_chunk(choice.delta.content, phase="outro")
    except Exception as exc:
        logger.warning("Feedback stream failed: %s", exc)
        yield persona_chunk("Research complete. Your results table is up to date.", phase="outro")


async def _chunk_words(text: str) -> AsyncIterator[str]:
    """Split plain text into word chunks for a faux stream (non-streaming SDK path)."""
    words = (text or "").split()
    for i, w in enumerate(words):
        yield w + (" " if i < len(words) - 1 else "")
        if i % 4 == 3:
            await asyncio.sleep(0)


def _top_values(leads: list[dict[str, Any]], field: str, limit: int = 3) -> str:
    counts = Counter()
    for lead in leads:
        value = str(lead.get(field) or "").strip()
        if value:
            counts[value] += 1
    if not counts:
        return ""
    return ", ".join(name for name, _count in counts.most_common(limit))
