from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Literal, Any
from collections import defaultdict

from app.core.config import settings
from app.services.llm_runtime import effective_model, effective_provider

logger = logging.getLogger(__name__)

# Pattern 19: LLM Gateway with Fallback
_rate_limited_until: dict[str, datetime] = {}
_call_counts: defaultdict[str, int] = defaultdict(int)

# Default fallback if primary fails or is limited
FALLBACK_CHAIN = [
    # (provider, tier_override or None)
    ("groq", None),
    ("openrouter", None),
    ("openai", None),
]

def _is_limited(provider: str) -> bool:
    until = _rate_limited_until.get(provider)
    if not until:
        return False
    if datetime.utcnow() > until:
        del _rate_limited_until[provider]
        return False
    return True

def _mark_limited(provider: str, error_msg: str):
    # Try to parse reset time if provided (e.g. "14m 29s")
    match = re.search(r"(\d+)m\s*(\d+)s", error_msg)
    if match:
        secs = int(match.group(1)) * 60 + int(match.group(2))
    else:
        secs = 60 # Default wait 1 minute
    
    _rate_limited_until[provider] = datetime.utcnow() + timedelta(seconds=secs)
    logger.warning(f"Provider {provider} rate limited for {secs}s")

Tier = Literal["reasoning", "fast"]

_openai_client = None
_groq_client = None
_openrouter_client = None


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








def should_use_openai_sdk_streaming() -> bool:
    """True when intro/outro should stream via AsyncOpenAI-compatible APIs."""
    p = effective_provider()
    if p == "openai":
        return bool((settings.OPENAI_API_KEY or "").strip())
    if p == "groq":
        return bool((settings.GROQ_API_KEY or "").strip())
    if p == "openrouter":
        return bool((settings.OPENROUTER_API_KEY or "").strip())
    if p == "deepseek":
        return False
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
    """Single-shot chat completion with automatic provider fallback."""
    primary_provider = effective_provider()
    
    # Re-order fallback chain and filter out providers with missing keys
    chain = []
    
    def _has_key(p: str) -> bool:
        if p == "openai": return bool((settings.OPENAI_API_KEY or "").strip())
        if p == "groq": return bool((settings.GROQ_API_KEY or "").strip())
        if p == "openrouter": return bool((settings.OPENROUTER_API_KEY or "").strip())
        if p == "anthropic": return bool((settings.ANTHROPIC_API_KEY or "").strip())
        return False

    # Primary first
    if _has_key(primary_provider):
        chain.append((primary_provider, None))
    
    # Then fallbacks (excluding primary if already added)
    for p, t in FALLBACK_CHAIN:
        if p != primary_provider and _has_key(p):
            chain.append((p, t))


    last_exc = None
    for provider, tier_override in chain:
        if _is_limited(provider):
            continue
            
        try:
            return _call_llm(
                provider, 
                system, 
                user, 
                tier=tier, 
                max_tokens=max_tokens, 
                temperature=temperature, 
                json_response=json_response
            )
        except Exception as exc:
            err = str(exc).lower()
            if "429" in err or "rate_limit" in err or "too many requests" in err:
                _mark_limited(provider, str(exc))
                last_exc = exc
                continue
            
            # Non-rate-limit errors should probably be logged and tried once more or reported
            logger.error(f"LLM call to {provider} failed: {exc}")
            last_exc = exc
            continue

    error_msg = f"All available AI providers (Groq, OpenRouter, OpenAI) are currently unavailable or rate-limited. Please wait 10 seconds and try again. [Last error: {last_exc}]" if last_exc else "No AI providers are configured or responsive."
    raise RuntimeError(error_msg)


from app.models.agent_metric import AgentMetric
from app.core.database import SessionLocal
from app.services.llm_runtime import effective_model, effective_provider, get_tracking
import time

def _call_llm(
    provider: str,
    system: str,
    user: str,
    *,
    tier: Tier = "reasoning",
    max_tokens: int = 1024,
    temperature: float = 0.2,
    json_response: bool = False,
) -> str:
    """Internal implementation for a single provider call with token tracking."""
    _call_counts[provider] += 1
    t0 = time.perf_counter()
    
    if provider in ("openai", "groq", "openrouter"):
        if provider == "openai":
            client = _openai()
        elif provider == "groq":
            client = _groq()
        elif provider == "openrouter":
            client = _openrouter()
        else:
            client = _openrouter()
            
        kwargs: dict = {
            "model": effective_model(tier, provider=provider),
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_response:
            kwargs["response_format"] = {"type": "json_object"}
            
        resp = client.chat.completions.create(**kwargs, timeout=30.0)
        content = resp.choices[0].message.content or ""
        
        # Capture metrics
        latency_ms = int((time.perf_counter() - t0) * 1000)
        usage = getattr(resp, "usage", None)
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0
        total_tokens = usage.total_tokens if usage else 0
        
        # Persist to DB if context is present
        track = get_tracking()
        if track and track.user_id:
            try:
                db = SessionLocal()
                metric = AgentMetric(
                    user_id=track.user_id,
                    session_id=track.session_id,
                    provider=provider,
                    model=kwargs["model"],
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency_ms
                )
                db.add(metric)
                db.commit()
                db.close()
            except Exception as e:
                logger.warning(f"Failed to persist agent metrics: {e}")

        return content

    raise RuntimeError(f"Unknown provider: {provider}")


def gateway_stats() -> dict:
    """Return stats about LLM usage and rate limits."""
    return {
        "calls": dict(_call_counts),
        "rate_limits": {p: u.isoformat() for p, u in _rate_limited_until.items() if u > datetime.utcnow()}
    }
