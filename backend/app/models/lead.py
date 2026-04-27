"""Lead ORM model — a scored person in a SearchSession's result set."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models._types import GUID, JSONType


class Lead(Base):
    """A single enriched and scored person, belonging to a SearchSession."""

    __tablename__ = "leads"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        GUID(),
        ForeignKey("search_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=True)
    title = Column(String, nullable=True)
    headline = Column(String, nullable=True)  # one-line "Role @ Company"
    company = Column(String, nullable=True)
    location = Column(String, nullable=True)
    country_code = Column(String(8), nullable=True)

    email = Column(String, nullable=True)

    # Social + web links — broad enough to cover creators, execs, engineers.
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    twitter_url = Column(String, nullable=True)
    instagram_url = Column(String, nullable=True)
    tiktok_url = Column(String, nullable=True)
    youtube_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    source_url = Column(String, nullable=True)

    followers = Column(Integer, nullable=True)
    person_type = Column(String, nullable=True)  # engineer|creator|executive|...

    match_score = Column(Float, default=0.0, nullable=False)
    match_status = Column(String, default="partially_matched", nullable=False)
    matched_criteria = Column(JSONType, default=dict, nullable=True)

    bio = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    skills = Column(JSONType, default=list, nullable=True)
    experience = Column(JSONType, default=list, nullable=True)  # [{company,title,start,end}]
    raw_data = Column(JSONType, default=dict, nullable=True)

    outreach_sent = Column(Boolean, default=False, nullable=False)
    is_saved = Column(Boolean, default=False, server_default="0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # User message that produced this lead (same session can hold multiple searches).
    source_query = Column(Text, nullable=True)

    session = relationship("SearchSession", back_populates="leads")
