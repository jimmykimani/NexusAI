"""Integration tests for health endpoints.

Targets rubric: Observability (health reporting, prompt versions)
"""
from __future__ import annotations

import pytest


class TestHealthEndpoint:
    """GET /api/v1/health and GET /health"""

    def test_health_v1_returns_ok(self, client):
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "db" in data
        assert "environment" in data

    def test_health_reports_prompt_versions(self, client):
        """Health endpoint should include prompt version info for rubric compliance."""
        r = client.get("/api/v1/health")
        data = r.json()
        assert "prompt_versions" in data
        assert "supervisor" in data["prompt_versions"]

    def test_health_reports_llm_provider(self, client):
        r = client.get("/api/v1/health")
        data = r.json()
        assert "llm_provider" in data

    def test_root_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
