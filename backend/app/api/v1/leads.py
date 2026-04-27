"""Leads endpoints — list grouped by match status, update, and delete."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.lead import Lead
from app.models.search_session import SearchSession
from app.models.user import User
from app.schemas.lead import LeadOut, LeadUpdate, LeadsByStatus

router = APIRouter()

_LIBRARY_LEAD_LIMIT = 500


def _owned_session_or_404(db: Session, session_id: UUID, user: User) -> SearchSession:
    """Fetch a session owned by the current user or raise 404."""
    ss = (
        db.query(SearchSession)
        .filter(SearchSession.id == session_id, SearchSession.user_id == user.id)
        .first()
    )
    if not ss:
        raise HTTPException(status_code=404, detail="Session not found")
    return ss


@router.get("", response_model=LeadsByStatus)
async def list_leads(
    session_id: UUID = Query(..., description="Session to fetch leads for"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LeadsByStatus:
    """Return leads grouped by match status."""
    _owned_session_or_404(db, session_id, user)

    rows = (
        db.query(Lead)
        .filter(Lead.session_id == session_id)
        .order_by(Lead.created_at.desc(), Lead.match_score.desc())
        .all()
    )
    fully = [LeadOut.model_validate(r) for r in rows if r.match_status == "fully_matched"]
    partial = [LeadOut.model_validate(r) for r in rows if r.match_status != "fully_matched"]
    return LeadsByStatus(fully_matched=fully, partially_matched=partial)


@router.get("/library", response_model=list[LeadOut])
async def list_lead_library(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LeadOut]:
    """All leads across the user's search sessions (My List). Must stay above ``/{lead_id}``."""
    rows = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(SearchSession.user_id == user.id, Lead.is_saved == True)
        .order_by(Lead.created_at.desc(), Lead.match_score.desc())
        .limit(_LIBRARY_LEAD_LIMIT)
        .all()
    )
    return [LeadOut.model_validate(r) for r in rows]


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LeadOut:
    """Fetch a single lead (must be owned by the current user)."""
    lead = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(Lead.id == lead_id, SearchSession.user_id == user.id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: UUID,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LeadOut:
    """Partially update a lead (e.g. add a manually found email)."""
    lead = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(Lead.id == lead_id, SearchSession.user_id == user.id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return LeadOut.model_validate(lead)
