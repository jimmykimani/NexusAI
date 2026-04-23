"""Aggregate all v1 routers under /api/v1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, health, leads, outreach, search

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(outreach.router, prefix="/outreach", tags=["outreach"])
