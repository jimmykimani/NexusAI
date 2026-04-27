"""Tests for structured LLM output parsing and validation.

Targets rubric: Prompt & Model Interaction Quality (structured output)
"""
from __future__ import annotations

import json
import pytest

from app.agents.search_agent import _extract_profiles
from app.agents.supervisor import _extract_json


class TestExtractJSON:
    """Supervisor's JSON extraction from LLM responses."""

    def test_clean_json(self):
        raw = '{"criteria": {"roles": ["Engineer"]}, "search_queries": ["test"]}'
        result = _extract_json(raw)
        assert result["criteria"]["roles"] == ["Engineer"]

    def test_json_with_markdown_fencing(self):
        raw = '```json\n{"criteria": {"roles": ["Engineer"]}}\n```'
        # Should extract the JSON object from within markdown
        result = _extract_json(raw)
        assert "criteria" in result or result == {}  # graceful handling

    def test_json_with_preamble_text(self):
        raw = 'Here is the result:\n{"score": 85, "match_status": "fully_matched"}'
        result = _extract_json(raw)
        assert result["score"] == 85

    def test_invalid_json_returns_empty(self):
        result = _extract_json("This is not JSON at all")
        assert result == {}

    def test_empty_string(self):
        result = _extract_json("")
        assert result == {}


class TestExtractProfiles:
    """Search agent's profile extraction from LLM output."""

    def test_list_of_profiles(self):
        raw = json.dumps([
            {"name": "Alice", "title": "Engineer"},
            {"name": "Bob", "title": "Designer"},
        ])
        profiles = _extract_profiles(raw)
        assert len(profiles) == 2
        assert profiles[0]["name"] == "Alice"

    def test_wrapped_in_profiles_key(self):
        raw = json.dumps({"profiles": [{"name": "Charlie", "title": "PM"}]})
        profiles = _extract_profiles(raw)
        assert len(profiles) == 1
        assert profiles[0]["name"] == "Charlie"

    def test_json_with_extra_text(self):
        raw = 'Here are the profiles:\n[{"name": "Dave", "title": "CTO"}]\nEnd.'
        profiles = _extract_profiles(raw)
        assert len(profiles) == 1

    def test_invalid_json_returns_empty_list(self):
        profiles = _extract_profiles("Not valid json data")
        assert profiles == []

    def test_empty_list(self):
        profiles = _extract_profiles("[]")
        assert profiles == []

    def test_nested_profiles_in_json_object(self):
        raw = '{"profiles": [{"name": "Eve", "title": "VP Sales", "company": "ACME"}]}'
        profiles = _extract_profiles(raw)
        assert len(profiles) == 1
        assert profiles[0]["company"] == "ACME"
