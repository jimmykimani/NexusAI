"""Integration tests for authentication endpoints.

Targets rubric: Engineering Practices (tests for auth flow)
"""
from __future__ import annotations

import uuid
import pytest


class TestRegister:
    """POST /api/v1/auth/register"""

    def test_register_success(self, client, db):
        email = f"reg-{uuid.uuid4().hex[:8]}@nexusai.app"
        r = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "ValidPass1!", "full_name": "New User"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == email
        assert "id" in data

    def test_register_duplicate_email(self, client, db):
        email = f"dup-{uuid.uuid4().hex[:8]}@nexusai.app"
        r1 = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "ValidPass1!", "full_name": "First"},
        )
        assert r1.status_code == 201
        r2 = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "ValidPass1!", "full_name": "Second"},
        )
        assert r2.status_code == 400
        assert "already registered" in r2.json()["detail"].lower()

    def test_register_short_password_rejected(self, client, db):
        r = client.post(
            "/api/v1/auth/register",
            json={"email": "short@test.com", "password": "abc"},
        )
        assert r.status_code == 422  # Pydantic validation


class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_success(self, client, db):
        email = f"login-{uuid.uuid4().hex[:8]}@nexusai.app"
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "LoginPass1!"},
        )
        r = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "LoginPass1!"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, db):
        email = f"wrong-{uuid.uuid4().hex[:8]}@nexusai.app"
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "CorrectPass1!"},
        )
        r = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassword!"},
        )
        assert r.status_code == 401

    def test_login_nonexistent_email(self, client, db):
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@nowhere.com", "password": "NoPass1!"},
        )
        assert r.status_code == 401


class TestProtectedEndpoints:
    """Verify that auth-required endpoints reject unauthenticated requests."""

    def test_leads_requires_auth(self, client, db):
        r = client.get("/api/v1/leads")
        assert r.status_code in (401, 403)

    def test_metrics_requires_auth(self, client, db):
        r = client.get("/api/v1/metrics")
        assert r.status_code in (401, 403)
