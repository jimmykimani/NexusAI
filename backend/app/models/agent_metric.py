"""AgentMetric ORM model — tracks LLM usage (tokens, cost) and performance metrics."""
from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models._types import GUID

class AgentMetric(Base):
    """Tracks token usage and latency for every LLM call."""
    __tablename__ = "agent_metrics"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(GUID(), ForeignKey("search_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    provider = Column(String, nullable=False) # groq|openai|...
    model = Column(String, nullable=False)
    
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    session = relationship("SearchSession")
