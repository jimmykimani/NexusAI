"""Search request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Payload for POST /search."""

    query: str = Field(min_length=3, max_length=2000)


class SearchStartResponse(BaseModel):
    """Response returned immediately after starting a search."""

    session_id: UUID
    status: str
    message: str


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
