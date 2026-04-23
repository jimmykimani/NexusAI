"""Short persona-driven copy streamed before/after the search graph runs.

Uses OpenAI streaming when LLM_PROVIDER=openai; otherwise falls back to a
single non-stream completion and yields it in one chunk.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

from app.core.config import settings
from app.services.llm import llm_chat

logger = logging.getLogger(__name__)

INTRO_SYSTEM = """You are NexusAI — a sharp, friendly research copilot (like a colleague who is great at people search).
The user just submitted a search. Reply in 2–4 short sentences, first person ("I'll…").
Acknowledge their goal, say you're setting up the search and scanning the open web, and sound confident — no bullet lists, no JSON, no emojis unless one tasteful emphasis fits.
Stay under 120 words."""

OUTRO_SYSTEM = """You are NexusAI — same voice as before: warm, concise, professional.
The search finished. Summarize what landed in the results table in 2–5 sentences.
Mention roughly how many strong vs weaker-fit profiles there are (use the counts provided).
Encourage them to scan the table and open profiles. No bullet lists, no JSON.
Stay under 160 words."""


def _reasoning_model() -> str:
    return settings.OPENAI_REASONING_MODEL


async def stream_intro_narrative(user_query: str) -> AsyncIterator[str]:
    """Yield streamed text tokens for the opening assistant message."""
    q = (user_query or "").strip()
    if not q:
        return

    if settings.LLM_PROVIDER != "openai" or not settings.OPENAI_API_KEY:
        text = llm_chat(
            INTRO_SYSTEM,
            f"User search:\n{q}",
            tier="reasoning",
            max_tokens=220,
            temperature=0.45,
        )
        async for part in _chunk_words(text):
            yield part
        return

    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        stream = await client.chat.completions.create(
            model=_reasoning_model(),
            max_tokens=220,
            temperature=0.45,
            messages=[
                {"role": "system", "content": INTRO_SYSTEM},
                {"role": "user", "content": f"User search:\n{q}"},
            ],
            stream=True,
        )
        async for chunk in stream:
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                yield choice.delta.content
    except Exception as exc:
        logger.warning("Intro narrative stream failed: %s", exc)
        yield "I'll run this search across the web and line up the best matches in your results table."


async def stream_outro_narrative(
    user_query: str,
    criteria: dict[str, Any],
    leads: list[dict[str, Any]],
    status: str | None,
) -> AsyncIterator[str]:
    """Yield streamed closing summary after the graph completes."""
    q = (user_query or "").strip()
    fully = sum(1 for l in leads if l.get("match_status") == "fully_matched")
    partial = len(leads) - fully
    roles = (criteria or {}).get("roles") or []
    loc = (criteria or {}).get("location") or ""

    ctx = (
        f"User search:\n{q}\n\n"
        f"Planner notes — roles: {roles!s}, location: {loc!r}\n"
        f"Result status: {status or 'complete'}\n"
        f"Counts: {fully} fully matched (strong fit), {partial} partially matched (weaker or incomplete signal).\n"
        f"Total rows in table: {len(leads)}."
    )

    if settings.LLM_PROVIDER != "openai" or not settings.OPENAI_API_KEY:
        text = llm_chat(
            OUTRO_SYSTEM,
            ctx,
            tier="reasoning",
            max_tokens=320,
            temperature=0.4,
        )
        async for part in _chunk_words(text):
            yield part
        return

    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        stream = await client.chat.completions.create(
            model=_reasoning_model(),
            max_tokens=320,
            temperature=0.4,
            messages=[
                {"role": "system", "content": OUTRO_SYSTEM},
                {"role": "user", "content": ctx},
            ],
            stream=True,
        )
        async for chunk in stream:
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                yield choice.delta.content
    except Exception as exc:
        logger.warning("Outro narrative stream failed: %s", exc)
        yield (
            f"Wrapped up with {len(leads)} profiles: {fully} strong matches and {partial} partial fits. "
            "Open any row to see the full picture."
        )


async def _chunk_words(text: str) -> AsyncIterator[str]:
    """Split plain text into word chunks for a faux stream (non-OpenAI path)."""
    words = (text or "").split()
    for i, w in enumerate(words):
        yield w + (" " if i < len(words) - 1 else "")
        if i % 4 == 3:
            await asyncio.sleep(0)
