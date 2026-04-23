"""Outreach endpoints — AI email composition + (mocked) send."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.outreach_agent import compose_email_for_lead
from app.core.deps import get_current_user, get_db
from app.models.lead import Lead
from app.models.search_session import SearchSession
from app.models.user import User
from app.schemas.outreach import (
    ComposedEmail,
    OutreachComposeRequest,
    OutreachComposeResponse,
    OutreachSendRequest,
    OutreachSendResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/compose", response_model=OutreachComposeResponse)
async def compose(
    payload: OutreachComposeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OutreachComposeResponse:
    """Generate personalized outreach emails for a batch of leads."""
    leads = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(Lead.id.in_(payload.lead_ids), SearchSession.user_id == user.id)
        .all()
    )
    if not leads:
        raise HTTPException(status_code=404, detail="No matching leads found")

    composed: list[ComposedEmail] = []
    for lead in leads:
        profile = {
            "name": lead.name,
            "title": lead.title,
            "company": lead.company,
            "location": lead.location,
            "skills": lead.skills,
            "bio": lead.bio,
            "email": lead.email,
        }
        draft = compose_email_for_lead(
            profile,
            context=payload.context,
            sender_name=payload.sender_name or (user.full_name or ""),
        )
        composed.append(
            ComposedEmail(
                lead_id=lead.id,
                to_name=lead.name,
                subject=draft["subject"],
                body=draft["body"],
            )
        )
    return OutreachComposeResponse(emails=composed)


@router.post("/send", response_model=OutreachSendResponse)
async def send(
    payload: OutreachSendRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OutreachSendResponse:
    """MOCKED email send — flips `outreach_sent` on the lead and returns an id."""
    lead = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(Lead.id == payload.lead_id, SearchSession.user_id == user.id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    message_id = f"mock-{uuid.uuid4().hex[:12]}"
    lead.outreach_sent = True
    db.commit()

    logger.info(
        "Mock-sent email to lead=%s subject=%r message_id=%s",
        lead.id,
        payload.subject,
        message_id,
    )

    return OutreachSendResponse(status="sent", message_id=message_id)
