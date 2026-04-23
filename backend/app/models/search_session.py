"""SearchSession ORM model — one per user-initiated search."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models._types import GUID, JSONType


class SearchSession(Base):
    """A single user-initiated search and its lifecycle metadata."""

    __tablename__ = "search_sessions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=True)
    original_query = Column(Text, nullable=False)
    criteria = Column(JSONType, nullable=True)
    status = Column(String, default="pending", nullable=False)
    lead_count = Column(Integer, default=0, nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="sessions")
    leads = relationship(
        "Lead",
        back_populates="session",
        cascade="all, delete-orphan",
    )
