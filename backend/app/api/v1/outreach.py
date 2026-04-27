"""Outreach endpoints — AI email composition + (mocked) send."""
from __future__ import annotations

import copy
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

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
    OutreachSentListResponse,
    SentEmailRecord,
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


def _merge_outreach_last_into_raw_data(
    raw: dict[str, Any] | None,
    *,
    message_id: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    meta = copy.deepcopy(raw) if isinstance(raw, dict) else {}
    nexus = meta.get("_nexus_meta")
    if not isinstance(nexus, dict):
        nexus = {}
    sent_at = datetime.now(timezone.utc).isoformat()
    nexus["outreach_last"] = {
        "message_id": message_id,
        "subject": subject,
        "body": body,
        "sent_at": sent_at,
    }
    meta["_nexus_meta"] = nexus
    return meta


@router.get("/sent", response_model=OutreachSentListResponse)
async def list_sent_emails(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OutreachSentListResponse:
    """Sent outreach history for the mailbox UI (from leads marked sent + stored meta)."""
    rows = (
        db.query(Lead)
        .join(SearchSession, Lead.session_id == SearchSession.id)
        .filter(SearchSession.user_id == user.id, Lead.outreach_sent.is_(True))
        .order_by(Lead.created_at.desc())
        .limit(300)
        .all()
    )
    records: list[SentEmailRecord] = []
    for lead in rows:
        raw = lead.raw_data
        if not isinstance(raw, dict):
            continue
        nexus = raw.get("_nexus_meta")
        if not isinstance(nexus, dict):
            continue
        last = nexus.get("outreach_last")
        if not isinstance(last, dict):
            continue
        mid = str(last.get("message_id") or "")
        rid = mid or str(lead.id)
        records.append(
            SentEmailRecord(
                id=rid,
                lead_id=str(lead.id),
                recipient_email=lead.email or "",
                recipient_name=lead.name,
                subject=str(last.get("subject") or ""),
                body=str(last.get("body") or ""),
                status="sent",
                message_id=mid,
                created_at=str(last.get("sent_at") or ""),
            )
        )
    records.sort(key=lambda r: r.created_at, reverse=True)
    return OutreachSentListResponse(emails=records)


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
    lead.raw_data = _merge_outreach_last_into_raw_data(
        lead.raw_data if isinstance(lead.raw_data, dict) else {},
        message_id=message_id,
        subject=payload.subject,
        body=payload.body,
    )
    db.commit()

    logger.info(
        "Mock-sent email to lead=%s subject=%r message_id=%s",
        lead.id,
        payload.subject,
        message_id,
    )

    return OutreachSendResponse(status="sent", message_id=message_id)
