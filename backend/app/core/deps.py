"""FastAPI dependency-injection helpers (DB session, current user)."""
from __future__ import annotations

from typing import Any, Generator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import decode_token, verify_clerk_jwt
from app.models.user import User

# When DISABLE_AUTH is true we don't force the header — frontend can still send one.
security_scheme = HTTPBearer(auto_error=False)

DEV_USER_EMAIL = "dev@local"


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session and close it when the request finishes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_dev_user(db: Session) -> User:
    """Return the dev user, creating it on first call."""
    user = db.query(User).filter(User.email == DEV_USER_EMAIL).first()
    if user:
        return user
    user = User(
        email=DEV_USER_EMAIL,
        hashed_password="!",  # unusable password; dev mode bypasses auth
        full_name="Dev User",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _email_from_clerk_claims(claims: dict[str, Any]) -> Optional[str]:
    """Best-effort email extraction from a Clerk session JWT."""
    # Session tokens usually include `email` at top level if configured.
    for key in ("email", "primary_email_address", "email_address"):
        value = claims.get(key)
        if isinstance(value, str) and value:
            return value.lower()
    # Alternative nesting under 'user' claim in some JWT templates
    user_claim = claims.get("user")
    if isinstance(user_claim, dict):
        em = user_claim.get("email") or user_claim.get("primary_email_address")
        if isinstance(em, str) and em:
            return em.lower()
    return None


def _resolve_clerk_user(db: Session, claims: dict[str, Any]) -> Optional[User]:
    """Find-or-create the local User row that mirrors a Clerk identity."""
    clerk_id = claims.get("sub")
    if not isinstance(clerk_id, str) or not clerk_id:
        return None
    user: Optional[User] = (
        db.query(User).filter(User.clerk_user_id == clerk_id).first()
    )
    if user:
        return user

    email = _email_from_clerk_claims(claims) or f"{clerk_id}@clerk.local"
    # Reuse existing row if a user with this email was created previously.
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.clerk_user_id = clerk_id
        db.commit()
        db.refresh(existing)
        return existing

    user = User(
        email=email,
        hashed_password=None,
        full_name=None,
        is_active=True,
        clerk_user_id=clerk_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def resolve_user_from_token(db: Session, token: str) -> Optional[User]:
    """Try Clerk first, then the legacy HS256 JWT. Returns None if neither works."""
    claims = verify_clerk_jwt(token)
    if claims:
        user = _resolve_clerk_user(db, claims)
        if user and user.is_active:
            return user
        return None

    payload = decode_token(token)
    if payload and "sub" in payload:
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if user and user.is_active:
            return user
    return None


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user.

    Resolution order:
    1. ``DISABLE_AUTH`` dev-bypass (returns a persistent dev user).
    2. Clerk-issued JWT (verified via JWKS).
    3. Legacy HS256 JWT (for backwards compatibility with the built-in login).
    """
    if settings.DISABLE_AUTH:
        return _get_or_create_dev_user(db)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    user = resolve_user_from_token(db, credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return user
