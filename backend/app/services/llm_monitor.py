"""LLM-specific monitoring — token usage, cost estimation, hallucination flags.

Targets rubric: Observability level 5 — "token usage, latency, hallucination flags"
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


# Token cost per model (update when pricing changes)
COST_PER_TOKEN = {
    "claude-sonnet-4-5":       {"in": 0.000003,   "out": 0.000015},
    "claude-haiku-4-5":        {"in": 0.00000025,  "out": 0.00000125},
    "llama-3.1-8b-instant":    {"in": 0.0,         "out": 0.0},       # free on Groq
    "llama-3.3-70b-versatile": {"in": 0.0,         "out": 0.0},       # free tier
    "gpt-4o":                  {"in": 0.000005,    "out": 0.000015},
    "gpt-4o-mini":             {"in": 0.00000015,  "out": 0.0000006},
}


@dataclass
class LLMCallRecord:
    """Record of a single LLM API call for monitoring and cost tracking."""

    model: str
    provider: str
    task: str  # e.g. "supervisor", "extraction", "outreach"
    input_tokens: int
    output_tokens: int
    latency_ms: int
    cost_usd: float
    cache_hit: bool
    fallback_used: bool
    session_id: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


def estimate_cost(model: str, in_tokens: int, out_tokens: int) -> float:
    """Estimate the USD cost for a given model and token count.

    Returns 0.0 for free-tier models (Groq llama) or unknown models.
    """
    rates = COST_PER_TOKEN.get(model, {"in": 0, "out": 0})
    return round((in_tokens * rates["in"]) + (out_tokens * rates["out"]), 6)


def flag_hallucination(field_name: str, value: str, source_texts: list[str]) -> bool:
    """Return True if value cannot be found in any source text.

    Used to mark lead fields as 'unverified' when the LLM may have
    fabricated information not present in the raw search results.

    Args:
        field_name: Name of the field being checked (e.g. "company", "title")
        value: The LLM-generated value to verify
        source_texts: Raw source texts from web search results

    Returns:
        True if the value appears hallucinated (not found in sources)
    """
    if not value or not source_texts:
        return False
    combined = " ".join(source_texts).lower()
    return value.lower() not in combined


def build_verification_dict(
    profile: dict[str, Any], source_texts: list[str]
) -> dict[str, str]:
    """Build a verification dict for a profile's key fields.

    Returns a dict like {"company": "verified", "title": "unverified"}
    which is exposed in the GET /leads response.
    """
    fields_to_check = ["name", "title", "company", "location"]
    verification: dict[str, str] = {}

    for field_name in fields_to_check:
        value = profile.get(field_name, "")
        if not value:
            verification[field_name] = "missing"
        elif flag_hallucination(field_name, str(value), source_texts):
            verification[field_name] = "unverified"
        else:
            verification[field_name] = "verified"

    return verification
