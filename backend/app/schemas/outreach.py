"""Outreach (email composition + send) schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class OutreachComposeRequest(BaseModel):
    """Payload for POST /outreach/compose."""

    lead_ids: list[UUID] = Field(min_length=1, max_length=50)
    context: str = Field(min_length=3, max_length=2000)
    sender_name: str | None = None


class ComposedEmail(BaseModel):
    """Single AI-composed email returned to the user."""

    lead_id: UUID
    to_name: str | None
    subject: str
    body: str


class OutreachComposeResponse(BaseModel):
    """Response returned by POST /outreach/compose."""

    emails: list[ComposedEmail]


class OutreachSendRequest(BaseModel):
    """Payload for POST /outreach/send (mocked for now)."""

    lead_id: UUID
    subject: str
    body: str


class OutreachSendResponse(BaseModel):
    """Response returned by POST /outreach/send."""

    status: str
    message_id: str


class SentEmailRecord(BaseModel):
    """One row in GET /outreach/sent — mirrors the frontend ``SentEmail`` shape."""

    id: str
    lead_id: str | None = None
    recipient_email: str
    recipient_name: str | None = None
    subject: str
    body: str
    status: str
    message_id: str
    created_at: str


class OutreachSentListResponse(BaseModel):
    emails: list[SentEmailRecord]
