"""Per-request LLM overrides (e.g. from the chat UI) via a ContextVar.

When unset, all behavior falls back to ``settings`` (environment defaults).
"""
from __future__ import annotations

import re
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Iterator, Literal

from app.core.config import settings

Tier = Literal["reasoning", "fast"]

_MODEL_ID_RE = re.compile(r"^[a-zA-Z0-9._/:-]{1,96}$")
_ALLOWED_PROVIDERS = frozenset({"openai", "groq", "openrouter", "anthropic"})


@dataclass(frozen=True, slots=True)
class LLMRequestOverride:
    provider: str
    reasoning_model: str
    fast_model: str


_override: ContextVar[LLMRequestOverride | None] = ContextVar(
    "llm_request_override", default=None
)


def get_override() -> LLMRequestOverride | None:
    return _override.get()


def effective_provider() -> str:
    o = _override.get()
    if o:
        return o.provider
    return settings.LLM_PROVIDER


def effective_model(tier: Tier) -> str:
    o = _override.get()
    if o:
        return o.reasoning_model if tier == "reasoning" else o.fast_model
    if settings.LLM_PROVIDER == "anthropic":
        return (
            settings.CLAUDE_REASONING_MODEL
            if tier == "reasoning"
            else settings.CLAUDE_FAST_MODEL
        )
    return (
        settings.OPENAI_REASONING_MODEL
        if tier == "reasoning"
        else settings.OPENAI_FAST_MODEL
    )


@contextmanager
def llm_request_context(override: LLMRequestOverride | None) -> Iterator[None]:
    if override is None:
        yield
        return
    token = _override.set(override)
    try:
        yield
    finally:
        _override.reset(token)


def validate_override(provider: str, reasoning: str, fast: str) -> LLMRequestOverride:
    """Raise ValueError if the triple is not usable for this deployment."""
    p = (provider or "").strip().lower()
    r = (reasoning or "").strip()
    f = (fast or "").strip()
    if p not in _ALLOWED_PROVIDERS:
        raise ValueError(f"Invalid llm_provider: {provider!r}")
    if not _MODEL_ID_RE.match(r) or not _MODEL_ID_RE.match(f):
        raise ValueError("Invalid model id (allowed: letters, digits, . _ / : -)")

    if p == "openai" and not (settings.OPENAI_API_KEY or "").strip():
        raise ValueError("OPENAI_API_KEY is not configured for OpenAI.")
    if p == "groq" and not (settings.GROQ_API_KEY or "").strip():
        raise ValueError("GROQ_API_KEY is not configured for Groq.")
    if p == "openrouter" and not (settings.OPENROUTER_API_KEY or "").strip():
        raise ValueError("OPENROUTER_API_KEY is not configured for OpenRouter.")
    if p == "anthropic" and not (settings.ANTHROPIC_API_KEY or "").strip():
        raise ValueError("ANTHROPIC_API_KEY is not configured for Anthropic.")

    return LLMRequestOverride(provider=p, reasoning_model=r, fast_model=f)
