"""Lead schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ExperienceItem(BaseModel):
    company: str | None = None
    title: str | None = None
    start: str | None = None
    end: str | None = None
    summary: str | None = None


class LeadOut(BaseModel):
    """Lead as exposed by the API."""

    id: UUID
    session_id: UUID
    name: str | None = None
    title: str | None = None
    headline: str | None = None
    company: str | None = None
    location: str | None = None
    country_code: str | None = None

    email: str | None = None

    linkedin_url: str | None = None
    github_url: str | None = None
    twitter_url: str | None = None
    instagram_url: str | None = None
    tiktok_url: str | None = None
    youtube_url: str | None = None
    website_url: str | None = None
    avatar_url: str | None = None
    source_url: str | None = None

    followers: int | None = None
    person_type: str | None = None

    match_score: float
    match_status: str
    matched_criteria: dict[str, Any] | None = None

    bio: str | None = None
    ai_summary: str | None = None
    skills: list[str] | None = None
    experience: list[ExperienceItem] | None = None

    outreach_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadUpdate(BaseModel):
    """Partial update for PATCH /leads/{id}."""

    email: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    twitter_url: str | None = None
    instagram_url: str | None = None
    tiktok_url: str | None = None
    youtube_url: str | None = None
    website_url: str | None = None
    name: str | None = None
    title: str | None = None
    headline: str | None = None
    company: str | None = None
    location: str | None = None


class LeadsByStatus(BaseModel):
    """Grouped leads response for GET /leads."""

    fully_matched: list[LeadOut]
    partially_matched: list[LeadOut]
