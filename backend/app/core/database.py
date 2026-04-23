"""SQLAlchemy engine, session factory, and declarative Base."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, future=True
)


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""
