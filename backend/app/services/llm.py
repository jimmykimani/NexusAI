"""LLM provider abstraction — OpenAI, Anthropic, Groq, or OpenRouter.

Agent nodes call `llm_chat()` instead of a vendor SDK directly. Groq and OpenRouter
use the OpenAI Python SDK against their OpenAI-compatible base URLs.
"""
from __future__ import annotations

import logging
from typing import Literal

from app.core.config import settings
from app.services.llm_runtime import effective_model, effective_provider

logger = logging.getLogger(__name__)

Tier = Literal["reasoning", "fast"]

_openai_client = None
_groq_client = None
_openrouter_client = None
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


def _groq():
    """OpenAI SDK pointed at Groq's OpenAI-compatible API."""
    global _groq_client
    if _groq_client is None:
        from openai import OpenAI  # lazy

        if not (settings.GROQ_API_KEY or "").strip():
            raise RuntimeError("GROQ_API_KEY is not set.")
        base = (settings.GROQ_BASE_URL or "").strip().rstrip("/")
        _groq_client = OpenAI(api_key=settings.GROQ_API_KEY.strip(), base_url=base)
    return _groq_client


def _openrouter():
    """OpenAI SDK pointed at OpenRouter."""
    global _openrouter_client
    if _openrouter_client is None:
        from openai import OpenAI  # lazy

        if not (settings.OPENROUTER_API_KEY or "").strip():
            raise RuntimeError("OPENROUTER_API_KEY is not set.")
        base = (settings.OPENROUTER_BASE_URL or "").strip().rstrip("/")
        key = settings.OPENROUTER_API_KEY.strip()
        headers: dict[str, str] = {}
        ref = (settings.OPENROUTER_HTTP_REFERER or "").strip()
        title = (settings.OPENROUTER_APP_TITLE or "").strip()
        if ref:
            headers["HTTP-Referer"] = ref
        if title:
            headers["X-Title"] = title
        kwargs: dict = {"api_key": key, "base_url": base}
        if headers:
            kwargs["default_headers"] = headers
        _openrouter_client = OpenAI(**kwargs)
    return _openrouter_client


def _anthropic():
    """Lazily construct an Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic  # lazy

        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set.")
        _anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def should_use_openai_sdk_streaming() -> bool:
    """True when intro/outro should stream via AsyncOpenAI-compatible APIs."""
    p = effective_provider()
    if p == "openai":
        return bool((settings.OPENAI_API_KEY or "").strip())
    if p == "groq":
        return bool((settings.GROQ_API_KEY or "").strip())
    if p == "openrouter":
        return bool((settings.OPENROUTER_API_KEY or "").strip())
    return False


def openai_style_async_client():
    """Async client for OpenAI, Groq, or OpenRouter chat completions."""
    from openai import AsyncOpenAI  # lazy

    p = effective_provider()
    if p == "groq":
        if not (settings.GROQ_API_KEY or "").strip():
            raise RuntimeError("GROQ_API_KEY is not set.")
        base = (settings.GROQ_BASE_URL or "").strip().rstrip("/")
        return AsyncOpenAI(api_key=settings.GROQ_API_KEY.strip(), base_url=base)
    if p == "openrouter":
        if not (settings.OPENROUTER_API_KEY or "").strip():
            raise RuntimeError("OPENROUTER_API_KEY is not set.")
        base = (settings.OPENROUTER_BASE_URL or "").strip().rstrip("/")
        key = settings.OPENROUTER_API_KEY.strip()
        headers: dict[str, str] = {}
        ref = (settings.OPENROUTER_HTTP_REFERER or "").strip()
        title = (settings.OPENROUTER_APP_TITLE or "").strip()
        if ref:
            headers["HTTP-Referer"] = ref
        if title:
            headers["X-Title"] = title
        kwargs: dict = {"api_key": key, "base_url": base}
        if headers:
            kwargs["default_headers"] = headers
        return AsyncOpenAI(**kwargs)
    if not (settings.OPENAI_API_KEY or "").strip():
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


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

    Returns the assistant text. If `json_response=True` for OpenAI-compatible
    providers, enables `response_format={"type": "json_object"}` when supported
    by the upstream model.
    """
    provider = effective_provider()

    if provider in ("openai", "groq", "openrouter"):
        if provider == "openai":
            client = _openai()
        elif provider == "groq":
            client = _groq()
        else:
            client = _openrouter()
        kwargs: dict = {
            "model": effective_model(tier),
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
            model=effective_model(tier),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text if resp.content else ""

    raise RuntimeError(
        f"Unknown LLM_PROVIDER: {provider!r}. "
        "Use openai, anthropic, groq, or openrouter."
    )
