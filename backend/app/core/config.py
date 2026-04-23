"""Application settings loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration for the backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # LLMs
    ANTHROPIC_API_KEY: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")

    # Search
    TAVILY_API_KEY: str = Field(default="")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://nexus:nexus@localhost:5432/nexusai"
    )

    # Auth
    JWT_SECRET_KEY: str = Field(default="change-me-change-me-change-me-change-me")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)

    # App
    ENVIRONMENT: str = Field(default="development")
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # Model selection (adjustable per deploy)
    CLAUDE_REASONING_MODEL: str = Field(default="claude-sonnet-4-5")
    CLAUDE_FAST_MODEL: str = Field(default="claude-haiku-4-5")
    OPENAI_REASONING_MODEL: str = Field(default="gpt-4o")
    OPENAI_FAST_MODEL: str = Field(default="gpt-4o-mini")

    # Provider choice: "openai" or "anthropic"
    LLM_PROVIDER: str = Field(default="openai")

    # Dev flag: skip JWT auth and use a default dev user (ONLY for local testing)
    DISABLE_AUTH: bool = Field(default=False)

    # Clerk (primary auth provider). Leave issuer blank to skip Clerk verification.
    CLERK_ISSUER: str = Field(default="https://tough-fox-32.clerk.accounts.dev")
    CLERK_SECRET_KEY: str = Field(default="")
    # Derived at runtime if blank
    CLERK_JWKS_URL: str = Field(default="")

    @property
    def clerk_jwks_url(self) -> str:
        if self.CLERK_JWKS_URL:
            return self.CLERK_JWKS_URL
        if self.CLERK_ISSUER:
            return self.CLERK_ISSUER.rstrip("/") + "/.well-known/jwks.json"
        return ""

    def assert_llm_keys(self) -> None:
        """Raise RuntimeError if required provider keys are missing."""
        missing: list[str] = []
        if self.LLM_PROVIDER == "openai" and not self.OPENAI_API_KEY:
            missing.append("OPENAI_API_KEY")
        if self.LLM_PROVIDER == "anthropic" and not self.ANTHROPIC_API_KEY:
            missing.append("ANTHROPIC_API_KEY")
        if not self.TAVILY_API_KEY:
            missing.append("TAVILY_API_KEY")
        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill them in."
            )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, value):
        """Allow CORS_ORIGINS as JSON list or comma-separated string in .env."""
        if value is None or value == "":
            return ["http://localhost:5173"]
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                import json
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """Cache settings so we don't re-parse .env for every call."""
    return Settings()


settings = get_settings()
