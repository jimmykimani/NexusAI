"""Decide whether the user is starting a people search or just chatting."""
from __future__ import annotations

import json
import logging
import re
from typing import Literal

from app.core.config import settings
from app.services.llm import llm_chat
from app.core.prompts import load_prompt

logger = logging.getLogger(__name__)

def get_intent_prompt() -> str:
    return load_prompt("turn_intent", "v1")

Intent = Literal["search", "conversation"]



# Meta questions about the product / assistant — run after search signals so
# "what can you find for me" still matches ``find`` and stays a search.
_CONVERSATION_META_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^what\s+can\s+you\s+do(\s+for\s+me)?[\s?.!]*$", re.I),
    re.compile(r"^what\s+do\s+you\s+do[\s?.!]*$", re.I),
    re.compile(r"^who\s+are\s+you[\s?.!]*$", re.I),
    re.compile(r"^how\s+are\s+you[\s?.!]*$", re.I),
    re.compile(r"^how\s+can\s+you\s+help[\s?.!]*$", re.I),
    re.compile(r"^what\s+are\s+you[\s?.!]*$", re.I),
    re.compile(r"^what\s+is\s+nexus", re.I),
    re.compile(r"^what'?s\s+nexus", re.I),
    re.compile(r"^tell\s+me\s+about\s+(yourself|you|nexus)", re.I),
    re.compile(r"^what\s+(can|do)\s+you\s+(offer|provide)", re.I),
    re.compile(r"^what\s+capabilit", re.I),
    re.compile(r"^what\s+are\s+your\s+capabilit", re.I),
    re.compile(r"^how\s+does\s+(this|it|nexus)", re.I),
    re.compile(r"^what\s+can\s+you\s+help\s+me\s+with", re.I),
)

# Strong signals the user wants web / profile discovery (not small talk).
_SEARCH_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bfind\b", re.I),
    re.compile(r"\bsearch(ing)?\b", re.I),
    re.compile(r"\blook(?:ing)?\s+for\b", re.I),
    re.compile(r"\blist\s+of\b", re.I),
    re.compile(r"\bsite:", re.I),
    re.compile(r"\blinkedin\b", re.I),
    re.compile(r"\bcrunchbase\b", re.I),
    re.compile(r"\bgithub\.com\b", re.I),
    re.compile(r"\b(hire|hiring|recruit|candidates?|talent\s+pool)\b", re.I),
    re.compile(
        r"\b(engineers?|developers?|managers?|directors?|executives?|founders?|creators?|influencers?)\b",
        re.I,
    ),
    re.compile(r"\b(product|project|program)\s+managers?\b", re.I),
    re.compile(r"\bpeople\s+who\b", re.I),
    re.compile(r"\bwho\s+(works?|worked|is|are)\b", re.I),
    re.compile(r"\b(previously|formerly|ex-)\b", re.I),
    re.compile(r"\b(at|@)\s+[A-Z][a-z]{2,}\b"),  # "at Google", "@Stripe"
    re.compile(r"\b\d{4}\b"),  # years often appear in recruiting-style queries
)


def classify_intent(text: str) -> Intent:
    """Lightweight routing: conversation for greetings / filler; else search if signals match."""
    raw = (text or "").strip()
    if not raw:
        return "conversation"
    lower = raw.lower()

    if any(p.search(lower) for p in _SEARCH_PATTERNS):
        return "search"

    if any(p.search(lower) for p in _CONVERSATION_META_PATTERNS):
        return "conversation"

    # Short social / meta messages without search vocabulary
    if len(raw) <= 72 and not re.search(r"[@/]", raw):
        tokens = re.findall(r"[a-z']+", lower)
        if not tokens:
            return "conversation"
        small_talk = {
            "hi",
            "hey",
            "hello",
            "yo",
            "sup",
            "thanks",
            "thank",
            "you",
            "thx",
            "ok",
            "okay",
            "yes",
            "no",
            "sure",
            "cool",
            "nice",
            "great",
            "bye",
            "goodbye",
            "please",
            "help",
            "continue",
            "go",
            "on",
            "more",
            "what",
            "when",
            "why",
            "how",
            "are",
            "is",
            "doing",
            "up",
            "there",
            "here",
            "again",
            "wait",
            "stop",
            "try",
            "got",
            "it",
            "awesome",
            "love",
            "lol",
            "can",
            "could",
            "would",
            "do",
            "does",
            "did",
            "with",
            "for",
            "me",
            "tell",
            "about",
            "yourself",
            "anything",
            "something",
            "else",
            "good",
            "morning",
            "afternoon",
            "evening",
            "howdy",
            "greetings",
            "heythere",
        }
        if all(t in small_talk or len(t) <= 2 for t in tokens):
            return "conversation"

    # Default: treat as a search request (product behavior).
    return "search"


def _parse_intent_json(raw: str) -> Intent | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[^{}]*\"intent\"[^{}]*\}", text, re.DOTALL)
        if not m:
            m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    val = str(obj.get("intent", "")).lower().strip()
    if val == "search":
        return "search"
    if val == "conversation":
        return "conversation"
    return None


def classify_intent_llm(text: str) -> Intent:
    """Ask the configured fast LLM whether to open the search pipeline or chat only."""
    raw = (text or "").strip()
    if not raw:
        return "conversation"
    use_json = settings.LLM_PROVIDER in ("openai", "groq", "openrouter")
    try:
        out = llm_chat(
            system=get_intent_prompt(),
            user=f"User message:\n---\n{raw[:6000]}\n---",
            tier="fast",
            max_tokens=120,
            temperature=0.05,
            json_response=use_json,
        )
        parsed = _parse_intent_json(out)
        if parsed is not None:
            return parsed
        logger.warning("Intent LLM returned unparseable output: %s", (out or "")[:200])
    except Exception as exc:
        logger.warning("Intent LLM failed, falling back to heuristics: %s", exc)
    return classify_intent(raw)


def resolve_intent(text: str) -> Intent:
    """Entry point for POST /search: LLM router (default) or regex-only via INTENT_ROUTER=heuristic."""
    raw = (text or "").strip()
    if not raw:
        return "conversation"
    if settings.INTENT_ROUTER == "heuristic":
        return classify_intent(raw)
    lower = raw.lower()
    if any(p.search(lower) for p in _CONVERSATION_META_PATTERNS):
        return "conversation"
    return classify_intent_llm(raw)
