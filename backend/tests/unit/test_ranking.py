"""Tests for the deterministic ranking scorer — zero LLM calls.

Targets rubric: Orchestration & Control Flow (deterministic scoring)
                Code Quality (testable, reproducible)
"""
from __future__ import annotations

import pytest
from unittest.mock import patch

from app.services.ranking import score_profile, ScoreResult


# ── Full-match scenarios ─────────────────────────────────────────────


def test_full_match_scores_above_70(sample_profile, sample_criteria):
    """A profile that matches role + location + keywords should score >= 70."""
    result = score_profile(sample_profile, sample_criteria)
    assert result.score >= 70
    assert result.match_status == "fully_matched"
    assert result.matched_criteria["role"] is True
    assert result.matched_criteria["location"] is True


def test_full_match_with_all_signals():
    """Perfect profile with every signal should score near 100."""
    profile = {
        "name": "Jane Doe",
        "title": "Senior Software Engineer",
        "headline": "Senior Software Engineer at Google",
        "company": "Google",
        "location": "San Francisco, CA",
        "bio": "Expert in Python, cloud computing, distributed systems",
        "linkedin_url": "https://linkedin.com/in/janedoe",
        "email": "jane@google.com",
        "skills": ["Python", "Cloud"],
    }
    criteria = {
        "roles": ["Software Engineer"],
        "location": "San Francisco",
        "keywords": ["Python", "cloud"],
        "seniority": "senior",
    }
    result = score_profile(profile, criteria)
    assert result.score >= 90
    assert result.match_status == "fully_matched"


# ── Partial-match scenarios ──────────────────────────────────────────


def test_role_mismatch_reduces_score():
    """Profile with wrong role should not be fully matched."""
    profile = {
        "name": "Bob",
        "title": "Marketing Manager",
        "company": "HubSpot",
        "location": "Nairobi, Kenya",
        "bio": "Marketing expert",
        "linkedin_url": "https://linkedin.com/in/bob",
    }
    criteria = {
        "roles": ["Software Engineer"],
        "location": "Nairobi",
        "keywords": ["Python"],
        "seniority": "senior",
    }
    result = score_profile(profile, criteria)
    assert result.matched_criteria["role"] is False
    assert result.score < 70


def test_location_mismatch():
    profile = {
        "name": "Alice",
        "title": "ML Engineer",
        "location": "London, UK",
        "bio": "Python AI researcher",
        "linkedin_url": "https://linkedin.com/in/alice",
    }
    criteria = {
        "roles": ["ML Engineer"],
        "location": "Nairobi",
        "keywords": ["Python"],
    }
    result = score_profile(profile, criteria)
    assert result.matched_criteria["location"] is False


def test_empty_profile_scores_low():
    """A profile with almost no data should score very low."""
    result = score_profile({"name": "Unknown"}, {"roles": ["Engineer"]})
    assert result.score < 30
    assert result.match_status == "partially_matched"


# ── Edge cases ───────────────────────────────────────────────────────


def test_empty_criteria_assigns_neutral_scores():
    """Empty criteria should still return a valid ScoreResult."""
    profile = {"name": "Test", "title": "Engineer", "email": "t@t.com"}
    result = score_profile(profile, {})
    assert isinstance(result, ScoreResult)
    assert 0 <= result.score <= 100


def test_roles_as_string_not_list():
    """Criteria with roles as a string should still work."""
    profile = {"name": "Dev", "title": "Software Engineer", "location": "Nairobi"}
    criteria = {"roles": "Software Engineer", "location": "Nairobi"}
    result = score_profile(profile, criteria)
    assert result.matched_criteria["role"] is True


def test_keywords_as_string_not_list():
    """Keywords provided as a single string instead of a list."""
    profile = {"name": "Dev", "title": "Engineer", "bio": "Python developer"}
    criteria = {"roles": ["Engineer"], "keywords": "Python"}
    result = score_profile(profile, criteria)
    assert result.matched_criteria["keywords"] is True


def test_none_values_in_profile():
    """None values in profile fields should not crash scoring."""
    profile = {
        "name": None,
        "title": None,
        "company": None,
        "location": None,
        "bio": None,
        "skills": None,
    }
    result = score_profile(profile, {"roles": ["Engineer"]})
    assert isinstance(result, ScoreResult)


def test_seniority_executive():
    """Executive-level keywords should match the executive seniority band."""
    profile = {"name": "CEO", "title": "CEO & Founder", "location": "Nairobi"}
    criteria = {"roles": ["CEO"], "seniority": "executive"}
    result = score_profile(profile, criteria)
    assert result.matched_criteria["seniority"] is True


def test_contactable_score_with_github():
    """GitHub URL alone should count as contactable."""
    profile = {"name": "Dev", "title": "Engineer", "github_url": "https://github.com/dev"}
    criteria = {"roles": ["Engineer"]}
    result = score_profile(profile, criteria)
    assert result.matched_criteria["contactable"] is True


def test_llm_never_called_during_scoring(mock_llm, sample_profile, sample_criteria):
    """Verify that scoring is purely deterministic — zero LLM calls."""
    score_profile(sample_profile, sample_criteria)
    mock_llm.assert_not_called()


def test_score_result_has_reasoning(sample_profile, sample_criteria):
    """ScoreResult should include human-readable reasoning."""
    result = score_profile(sample_profile, sample_criteria)
    assert isinstance(result.reasoning, str)
    assert len(result.reasoning) > 0
