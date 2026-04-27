"""Shared LangGraph state types for the NexusAI agent graph."""
from __future__ import annotations

import operator
from typing import Annotated, Any, List, Optional, TypedDict


class StreamEvent(TypedDict, total=False):
    """A single event streamed to the frontend via SSE."""

    type: str  # plan | searching | found | ranking | complete | error | persona_chunk | meta | stream_end | evaluate
    message: str
    data: Optional[dict[str, Any]]


class NexusState(TypedDict, total=False):
    """State threaded through every node in the agent graph."""

    # Input
    query: str
    session_id: str
    user_id: str
    chat_history: List[dict[str, str]]

    # Supervisor output
    criteria: dict[str, Any]
    search_queries: List[str]

    # Search output
    raw_results: List[dict[str, Any]]

    # Ranking output
    leads: List[dict[str, Any]]

    # Control
    status: str
    error: Optional[str]

    # Append-only event stream
    events: Annotated[List[StreamEvent], operator.add]

    # Evaluation & Iteration
    retry_count: int
    research_results: List[dict[str, Any]]
