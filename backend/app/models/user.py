"""User ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models._types import GUID


class User(Base):
    """Platform user. Owns many SearchSessions."""

    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    # Nullable because Clerk-authed users won't have a local password.
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # When populated, this user was provisioned via Clerk. The value is the
    # Clerk user ID (e.g. ``user_2abc...``) from the ``sub`` claim.
    clerk_user_id = Column(String, unique=True, index=True, nullable=True)

    sessions = relationship(
        "SearchSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
