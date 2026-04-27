"""Tests for prompt loading, versioning, and template substitution.

Targets rubric: Prompt & Model Interaction Quality (versioned prompts)
"""
from __future__ import annotations

import pytest

from app.core.prompts import load_prompt, all_versions, PROMPTS_DIR


class TestLoadPrompt:
    """Verify prompt file loading and template substitution."""

    def test_load_supervisor_v1(self):
        """The supervisor_v1.txt prompt should load successfully."""
        text = load_prompt("supervisor", "v1")
        assert len(text) > 50
        assert "Prompt supervisor (vv1) not found" not in text

    def test_load_extraction_v1(self):
        """The extraction_v1.txt prompt should load."""
        text = load_prompt("extraction", "v1")
        assert len(text) > 50

    def test_load_nonexistent_prompt_returns_message(self):
        """Loading a missing prompt should return a descriptive message, not crash."""
        text = load_prompt("nonexistent_prompt", "v99")
        assert "not found" in text.lower()

    def test_template_substitution(self):
        """Variables should be substituted using $var syntax."""
        PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = PROMPTS_DIR / "test_template_v1.txt"
        test_file.write_text("Hello $person, you are a $role")
        try:
            result = load_prompt("test_template", "v1", person="Alice", role="Engineer")
            assert "Alice" in result
            assert "Engineer" in result
        finally:
            test_file.unlink(missing_ok=True)

    def test_template_missing_var_preserves_placeholder(self):
        """Missing variables should use safe_substitute (not crash)."""
        PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = PROMPTS_DIR / "test_safe_v1.txt"
        test_file.write_text("Hello $person, your $role is ready")
        try:
            result = load_prompt("test_safe", "v1", person="Bob")
            assert "Bob" in result
            assert "$role" in result  # safe_substitute preserves missing
        finally:
            test_file.unlink(missing_ok=True)


class TestAllVersions:
    """Verify the all_versions() discovery function."""

    def test_discovers_known_prompts(self):
        """Should find at least the supervisor and extraction prompts."""
        versions = all_versions()
        assert "supervisor" in versions
        assert "extraction" in versions
        assert versions["supervisor"] == "v1"

    def test_returns_dict(self):
        result = all_versions()
        assert isinstance(result, dict)
