"""JWT creation/verification and password hashing helpers."""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


logger = logging.getLogger(__name__)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(subject: str, extra: Optional[dict[str, Any]] = None) -> str:
    """Create a signed JWT access token with the configured expiry."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a legacy HS256 JWT, returning payload dict or None."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# --- Clerk JWT verification (RS256 via JWKS) ----------------------------------

_JWKS_CACHE: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_LOCK = threading.Lock()
_JWKS_TTL_SECONDS = 600  # 10 min


def _fetch_jwks() -> Optional[dict[str, Any]]:
    """Fetch and cache Clerk's JWKS. Thread-safe, TTL-bounded."""
    url = settings.clerk_jwks_url
    if not url:
        return None
    now = time.time()
    with _JWKS_LOCK:
        if (
            _JWKS_CACHE["keys"] is not None
            and (now - _JWKS_CACHE["fetched_at"]) < _JWKS_TTL_SECONDS
        ):
            return _JWKS_CACHE["keys"]
        try:
            resp = httpx.get(url, timeout=5.0)
            resp.raise_for_status()
            data = resp.json()
            _JWKS_CACHE["keys"] = data
            _JWKS_CACHE["fetched_at"] = now
            return data
        except Exception as exc:  # pragma: no cover - network
            logger.warning("Failed to fetch Clerk JWKS from %s: %s", url, exc)
            return _JWKS_CACHE["keys"]  # return stale if available


def _find_jwk(kid: str) -> Optional[dict[str, Any]]:
    jwks = _fetch_jwks()
    if not jwks:
        return None
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            return jwk
    return None


def verify_clerk_jwt(token: str) -> Optional[dict[str, Any]]:
    """Verify a Clerk-issued JWT using the configured JWKS; return claims or None.

    Trusts the issuer configured via ``settings.CLERK_ISSUER``. Returns None on
    any failure (unknown kid, bad signature, expired, wrong issuer, etc.).
    """
    if not settings.CLERK_ISSUER:
        return None
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        return None
    kid = header.get("kid")
    if not kid:
        return None
    jwk = _find_jwk(kid)
    if not jwk:
        # Possibly a rotated key; bust the cache once and retry.
        with _JWKS_LOCK:
            _JWKS_CACHE["fetched_at"] = 0.0
        jwk = _find_jwk(kid)
        if not jwk:
            return None
    try:
        claims = jwt.decode(
            token,
            jwk,
            algorithms=[jwk.get("alg", "RS256")],
            issuer=settings.CLERK_ISSUER.rstrip("/"),
            # Clerk session tokens don't always include an 'aud' claim. Skip
            # audience verification to avoid false negatives.
            options={"verify_aud": False},
        )
        return claims
    except JWTError as exc:
        logger.debug("Clerk JWT decode failed: %s", exc)
        return None
