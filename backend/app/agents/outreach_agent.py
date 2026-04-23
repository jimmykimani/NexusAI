"""Outreach agent — composes personalized emails per lead."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services.llm import llm_chat

logger = logging.getLogger(__name__)


OUTREACH_PROMPT = """You are a personalized cold-outreach email writer.

Write a short, human-sounding email to the given person.

Rules:
- 80-140 words total.
- Reference 1-2 specific facts from the person's profile (role, company, skills, or location).
- No marketing fluff, no exclamation marks.
- Clear single ask in the closing line.
- Tone: warm, confident, peer-to-peer.

Respond ONLY with JSON:
{"subject": "<short subject line>", "body": "<email body with \\n newlines>"}
"""


def _extract_json(text: str) -> dict[str, Any]:
    """Tolerant JSON extractor."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return {}
        return {}


def compose_email_for_lead(
    lead: dict[str, Any],
    context: str,
    sender_name: str | None = None,
) -> dict[str, str]:
    """Draft a subject+body for a single lead using the reasoning-tier LLM."""
    profile_summary = {
        "name": lead.get("name"),
        "title": lead.get("title"),
        "company": lead.get("company"),
        "location": lead.get("location"),
        "skills": lead.get("skills"),
        "bio": lead.get("bio"),
    }

    user_content = (
        f"Sender's context / goal: {context}\n"
        f"Sender name: {sender_name or 'The NexusAI user'}\n"
        f"Target profile: {json.dumps(profile_summary)}"
    )

    text = llm_chat(
        system=OUTREACH_PROMPT,
        user=user_content,
        tier="reasoning",
        max_tokens=700,
        temperature=0.4,
        json_response=True,
    )

    parsed = _extract_json(text)
    subject = str(parsed.get("subject") or "Quick question").strip()
    body = str(parsed.get("body") or "").strip()
    if not body:
        raise RuntimeError("Outreach LLM returned empty body.")
    return {"subject": subject, "body": body}
