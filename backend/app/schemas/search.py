"""Search request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Payload for POST /search."""

    query: str = Field(min_length=1, max_length=2000)
    continue_session_id: UUID | None = Field(
        default=None,
        description="Re-run search in this session (same sidebar thread; leads accumulate).",
    )


class SearchStartResponse(BaseModel):
    """Response returned immediately after starting a search."""

    mode: Literal["search"] = "search"
    session_id: UUID
    status: str
    message: str


class ConversationStartResponse(BaseModel):
    """No DB session — chat-only turn for greetings / small talk."""

    mode: Literal["conversation"] = "conversation"
    reply: str


class SearchSessionOut(BaseModel):
    """Public search-session shape for list/detail endpoints."""

    id: UUID
    title: str | None
    original_query: str
    status: str
    lead_count: int
    criteria: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchSessionList(BaseModel):
    """List response for GET /search."""

    sessions: list[SearchSessionOut]
