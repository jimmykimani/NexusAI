"""Short, persona-led replies when the user is chatting instead of running a search."""
from __future__ import annotations

from app.services.llm import llm_chat

NEXUS_PERSONA = """You are NexusAI — a sharp, warm teammate who helps people discover
real humans on the open web (roles, companies, creators, investors, etc.).

They may be saying hi, thanking you, asking who you are, or what you can do — NOT a search brief.
Reply in a friendly, concise way (2–5 short sentences). Be human: light humor is fine.
If they ask what you can do, briefly explain: you help them describe people (roles, companies,
creators, etc.), search the open web, score matches, and draft outreach — then invite a real search brief.
Acknowledge what they said, reflect energy back. Do NOT run a search, do NOT promise results,
and do NOT list fake people."""


def conversational_reply(user_message: str, chat_history: list[dict[str, str]] | None = None) -> str:
    """Single fast-model turn for sidebar chat that should not hit Tavily."""
    text = (user_message or "").strip()
    if not text:
        return "Hey! Tell me who you’re trying to find — role, company, or niche works."

    history_text = ""
    if chat_history:
        lines = []
        for turn in chat_history:
            lines.append(f"User: {turn.get('query')}")
            if turn.get('assistant_summary'):
                lines.append(f"Assistant: {turn.get('assistant_summary')}")
        history_text = "PREVIOUS CHAT HISTORY:\n" + "\n".join(lines) + "\n\n"

    return llm_chat(
        system=NEXUS_PERSONA,
        user=f"{history_text}CURRENT MESSAGE: {text}",
        tier="fast",
        max_tokens=320,
        temperature=0.75,
        json_response=False,
    ).strip()
