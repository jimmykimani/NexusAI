"""Application settings loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AliasChoices, Field, field_validator
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
    GROQ_API_KEY: str = Field(default="")
    OPENROUTER_API_KEY: str = Field(default="")


    # LangSmith / LangChain observability
    LANGCHAIN_TRACING_V2: bool = Field(default=False)
    LANGCHAIN_API_KEY: str = Field(default="")
    LANGCHAIN_PROJECT: str = Field(default="nexusai-development")

    # GitHub API (free, 5k req/hour authenticated)
    GITHUB_TOKEN: str = Field(default="")

    # Search
    TAVILY_API_KEY: str = Field(default="")
    SERPER_API_KEY: str = Field(default="")
    # Optional: Apollo.io People Search (merged with Tavily). Accepts common env names.
    APOLLO_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices(
            "APOLLO_API_KEY",
            "APOLLO_KEY",
            "APOLLO_IO_API_KEY",
            "APOLLO_MASTER_API_KEY",
        ),
    )
    # Optional: Apollo login email (same value Scrupp often expects in ``account`` for linked Apollo).
    APOLLO_LOGIN_EMAIL: str = Field(
        default="",
        validation_alias=AliasChoices("APOLLO_LOGIN_EMAIL", "APOLLO_ACCOUNT_EMAIL"),
    )
    # Scrupp: Apollo people export via https://api.scrupp.com (Bearer or api_key).
    SCRUPP_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("SCRUPP_API_KEY", "SCRUPP_KEY"),
    )
    # Some Scrupp Apollo flows require a linked Apollo account id/slug from the Scrupp dashboard.
    SCRUPP_APOLLO_ACCOUNT: str = Field(
        default="",
        validation_alias=AliasChoices("SCRUPP_APOLLO_ACCOUNT", "SCRUPP_ACCOUNT"),
    )
    # Clay REST API (https://api.clay.com) — reserved for enrichments / future use.
    CLAY_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("CLAY_API_KEY", "CLAY_KEY"),
    )

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
    # Used for openai | groq | openrouter (vendor-specific model ids, e.g. llama-3.3-70b-versatile)
    OPENAI_REASONING_MODEL: str = Field(default="gpt-4o")
    OPENAI_FAST_MODEL: str = Field(default="gpt-4o-mini")

    GROQ_REASONING_MODEL: str = Field(default="llama-3.3-70b-versatile")
    GROQ_FAST_MODEL: str = Field(default="llama-3.1-8b-instant")

    # openai | anthropic | groq | openrouter
    LLM_PROVIDER: str = Field(default="groq")

    # POST /search routing: llm = fast model classifies search vs chat; heuristic = regex only (no extra call).
    INTENT_ROUTER: str = Field(default="llm")

    GROQ_BASE_URL: str = Field(default="https://api.groq.com/openai/v1")
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")

    OPENROUTER_HTTP_REFERER: str = Field(
        default="http://localhost:5173",
        description="Optional attribution header for OpenRouter.",
    )
    OPENROUTER_APP_TITLE: str = Field(
        default="NexusAI",
        description="Optional X-Title header for OpenRouter.",
    )

    # Dev flag: skip JWT auth and use a default dev user (ONLY for local testing)
    DISABLE_AUTH: bool = Field(default=False)

    # Feature Flags
    ENABLE_LLM_RERANK: bool = Field(default=False)
    ENABLE_SEARCH_NARRATION: bool = Field(default=True)
    ENABLE_CHROMA: bool = Field(default=False)

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
        if self.LLM_PROVIDER == "groq" and not (self.GROQ_API_KEY or "").strip():
            missing.append("GROQ_API_KEY")
        if self.LLM_PROVIDER == "openrouter" and not (self.OPENROUTER_API_KEY or "").strip():
            missing.append("OPENROUTER_API_KEY")

        if not self.TAVILY_API_KEY:
            missing.append("TAVILY_API_KEY")
        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill them in."
            )

    @field_validator("INTENT_ROUTER", mode="before")
    @classmethod
    def _intent_router(cls, value: object) -> str:
        v = (value if value is not None else "llm")
        s = str(v).strip().lower()
        if s not in ("llm", "heuristic"):
            return "llm"
        return s

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
