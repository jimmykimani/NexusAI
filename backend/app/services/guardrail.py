import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Very simple PII regex for demo safety
# We detect: Emails (to ensure no fabrication), Phone Numbers, SSN-like patterns
PII_PATTERNS = {
    "email": r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
    "phone": r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
    "ssn": r"\d{3}-\d{2}-\d{4}",
}

def mask_pii(text: str) -> str:
    """Mask specific PII patterns in string data."""
    if not isinstance(text, str) or not text:
        return text
        
    out = text
    for label, pattern in PII_PATTERNS.items():
        if label == "email":
            # Just obscure it a bit, don't remove (important for outreach app)
            def _obs(m):
                e = m.group(0)
                if "@" not in e: return e
                user, dom = e.split("@", 1)
                return f"{user[0]}...@{dom}"
            out = re.sub(pattern, _obs, out)
        else:
            out = re.sub(pattern, f"[{label.upper()}_MASKED]", out)
    return out

def check_leads_pii(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Clean all text fields in a list of leads."""
    fields_to_clean = ["bio", "ai_summary", "headline", "title", "location"]
    
    for lead in leads:
        for field in fields_to_clean:
            val = lead.get(field)
            if val and isinstance(val, str):
                lead[field] = mask_pii(val)
                
    return leads
