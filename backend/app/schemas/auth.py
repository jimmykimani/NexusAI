"""Auth request/response schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user response shape."""

    id: UUID
    email: EmailStr
    full_name: str | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT issued by login."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
