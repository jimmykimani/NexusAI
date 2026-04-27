"""Shared pytest fixtures for NexusAI backend tests.

Provides an in-memory SQLite database, a FastAPI test client with auth
bypass, and mock factories for LLM / Tavily so tests run without API keys.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
# Mock security functions to skip passlib/bcrypt bugs during tests
@pytest.fixture(autouse=True)
def mock_security():
    with patch("app.api.v1.auth.hash_password", side_effect=lambda x: f"mock_hash_{x}"), \
         patch("app.api.v1.auth.verify_password", side_effect=lambda p, h: h == f"mock_hash_{p}"):
        yield

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.deps import get_db
from app.main import app
from app.models.user import User
from app.models.search_session import SearchSession
from app.models.lead import Lead


TEST_DB_URL = "sqlite://"  # in-memory, no file


@pytest.fixture()
def db_engine():
    """Create a fresh in-memory SQLite engine per test."""
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign key support in SQLite
    @event.listens_for(engine, "connect")
    def _set_sqlite_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db(db_engine):
    """Yield a DB session with fresh tables per test."""
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with the DB dependency overridden."""
    def _override_db():
        try:
            yield db
        finally:
            pass  # session is managed by the db fixture

    app.dependency_overrides[get_db] = _override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(db) -> User:
    """Create and return a test user in the DB."""
    user = User(
        id=uuid.uuid4(),
        email="test@nexusai.app",
        hashed_password="$2b$12$dummyhashfortest000000000000000000000000000000",
        full_name="Test User",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def auth_headers(client) -> dict[str, str]:
    """Register + login via the API to get valid JWT headers."""
    email = f"auth-{uuid.uuid4().hex[:8]}@nexusai.app"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Test1234!x", "full_name": "Auth User"},
    )
    assert r.status_code == 201, f"Register failed: {r.text}"
    r = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Test1234!x"},
    )
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_llm():
    """Patches llm_chat so tests run with zero real LLM calls."""
    with patch("app.services.llm.llm_chat") as mock:
        mock.return_value = '{"criteria": {"roles": ["Software Engineer"], "location": "Nairobi, Kenya", "keywords": ["Python", "AI"], "seniority": "senior"}, "search_queries": ["senior software engineers Nairobi"], "confidence": 0.9}'
        yield mock


@pytest.fixture
def mock_tavily():
    """Returns fake Tavily results. No real web calls."""
    with patch("app.agents.search_agent._tavily_search") as mock:
        mock.return_value = (
            [
                {
                    "url": "https://linkedin.com/in/test-engineer",
                    "title": "Ernest Kimani - ML Engineer",
                    "content": "Ernest Kimani, ML Engineer at Safaricom, Nairobi, Kenya. Python, AI.",
                },
                {
                    "url": "https://github.com/earnest",
                    "title": "earnest - GitHub",
                    "content": "AI researcher and Python developer based in Kenya.",
                },
            ],
            False,  # not fatal
        )
        yield mock


@pytest.fixture
def sample_profile() -> dict:
    """A realistic profile dict for scoring tests."""
    return {
        "name": "Ernest Kimani",
        "title": "Senior ML Engineer",
        "headline": "Senior ML Engineer at Safaricom",
        "company": "Safaricom",
        "location": "Nairobi, Kenya",
        "bio": "Python AI researcher with 5 years of experience in machine learning.",
        "linkedin_url": "https://linkedin.com/in/ernest-kimani",
        "email": "ernest@example.com",
        "skills": ["Python", "AI", "Machine Learning"],
    }


@pytest.fixture
def sample_criteria() -> dict:
    """Matching search criteria for the sample profile."""
    return {
        "roles": ["ML Engineer"],
        "location": "Nairobi",
        "keywords": ["Python", "AI"],
        "seniority": "senior",
    }
