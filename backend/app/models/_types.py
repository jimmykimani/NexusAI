"""Cross-dialect SQLAlchemy column types.

These adapt to `postgresql.UUID/JSONB` when running against Postgres and fall
back to `CHAR(36)` / generic `JSON` on SQLite so the same ORM models work in
development without needing a real Postgres instance.
"""
from __future__ import annotations

import uuid as _uuid
from typing import Any

from sqlalchemy import JSON, CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB, UUID


class GUID(TypeDecorator):
    """Platform-independent UUID type.

    On PostgreSQL uses native UUID; on other dialects stores stringified UUIDs
    in a CHAR(36) column. Always exposes Python `uuid.UUID` instances on the
    Python side.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):  # noqa: D401 - SQLAlchemy API
        if dialect.name == "postgresql":
            return dialect.type_descriptor(UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value: Any, dialect):  # noqa: D401
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value))
        return str(value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value)))

    def process_result_value(self, value: Any, dialect):  # noqa: D401
        if value is None:
            return None
        if isinstance(value, _uuid.UUID):
            return value
        return _uuid.UUID(str(value))


class JSONType(TypeDecorator):
    """JSONB on Postgres, generic JSON elsewhere."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):  # noqa: D401
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())
