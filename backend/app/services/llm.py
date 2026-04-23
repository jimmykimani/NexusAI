"""LLM provider abstraction — supports OpenAI and Anthropic interchangeably.

Agent nodes call `llm_chat()` instead of a vendor SDK directly so we can
switch providers via the `LLM_PROVIDER` env var.
"""
from __future__ import annotations

import logging
from typing import Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

Tier = Literal["reasoning", "fast"]

_openai_client = None
_anthropic_client = None


def _openai():
    """Lazily construct an OpenAI client."""
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI  # lazy

        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set.")
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _anthropic():
    """Lazily construct an Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic  # lazy

        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set.")
        _anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def _model_for(tier: Tier) -> str:
    """Pick the model name given the configured provider + tier."""
    if settings.LLM_PROVIDER == "anthropic":
        return settings.CLAUDE_REASONING_MODEL if tier == "reasoning" else settings.CLAUDE_FAST_MODEL
    return settings.OPENAI_REASONING_MODEL if tier == "reasoning" else settings.OPENAI_FAST_MODEL


def llm_chat(
    system: str,
    user: str,
    *,
    tier: Tier = "reasoning",
    max_tokens: int = 1024,
    temperature: float = 0.2,
    json_response: bool = False,
) -> str:
    """Single-shot chat completion, provider-agnostic.

    Returns the assistant text. If `json_response=True` and using OpenAI,
    enables `response_format={"type": "json_object"}` for stricter parsing.
    """
    provider = settings.LLM_PROVIDER

    if provider == "openai":
        client = _openai()
        kwargs: dict = {
            "model": _model_for(tier),
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_response:
            kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    if provider == "anthropic":
        client = _anthropic()
        resp = client.messages.create(
            model=_model_for(tier),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text if resp.content else ""

    raise RuntimeError(f"Unknown LLM_PROVIDER: {provider!r}")
