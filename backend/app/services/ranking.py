from dataclasses import dataclass
from typing import Literal

@dataclass
class ScoreResult:
    score: float
    match_status: Literal["fully_matched", "partially_matched"]
    matched_criteria: dict[str, bool]
    reasoning: str

def score_profile(profile: dict, criteria: dict) -> ScoreResult:
    """
    Deterministic scorer. Zero LLM calls.
    Weights: role(35) + location(25) + keywords(20) + contactable(10)
             + seniority(5) + completeness(5) = 100
    """
    score = 0.0
    matched = {}

    # Role match (35pts)
    # Search in title and headline
    title_text = f"{profile.get('title','') or ''} {profile.get('headline','') or ''}".lower()
    roles = criteria.get("roles", [])
    if isinstance(roles, str):
        roles = [roles]
    
    role_hit = any(r.lower() in title_text for r in roles if r.strip())
    matched["role"] = role_hit
    if role_hit: score += 35

    # Location match (25pts)
    target_loc = criteria.get("location", "").lower().strip()
    profile_loc = (profile.get("location", "") or "").lower()
    
    # Simple check: if city name is in profile location
    loc_hit = False
    if target_loc:
        city_part = target_loc.split(",")[0].strip()
        if city_part in profile_loc:
            loc_hit = True
    
    matched["location"] = loc_hit
    if loc_hit: score += 25

    # Keyword/skills match (20pts — partial credit)
    keywords = criteria.get("keywords", []) or []
    if isinstance(keywords, str):
        keywords = [keywords]
        
    profile_text = " ".join([
        str(profile.get("bio", "") or ""), 
        str(profile.get("skills", []) or ""),
        str(profile.get("title", "") or ""), 
        str(profile.get("headline", "") or ""),
    ]).lower()
    
    valid_kws = [k.lower() for k in keywords if k.strip()]
    kw_hits = sum(1 for k in valid_kws if k in profile_text)
    
    if valid_kws:
        kw_score = min(20, kw_hits * (20 / len(valid_kws)))
    else:
        kw_score = 15  # Neutral if no keywords specified
        
    matched["keywords"] = kw_hits > 0 if valid_kws else True
    score += kw_score

    # Contactable (10pts)
    contactable = bool(profile.get("email") or profile.get("linkedin_url") or profile.get("github_url"))
    matched["contactable"] = contactable
    if contactable: score += 10

    # Seniority match (5pts)
    SENIORITY_MAP = {
        "senior":    ["senior", "lead", "principal", "staff", "head of", "snr", "manager"],
        "executive": ["cto", "ceo", "vp", "director", "chief", "founder", "head of", "partner"],
        "mid":       ["engineer", "developer", "designer", "analyst", "manager", "medior"],
        "junior":    ["junior", "intern", "associate", "graduate", "trainee", "entry"],
    }
    target = criteria.get("seniority", "").lower()
    seniority_hit = any(w in title_text for w in SENIORITY_MAP.get(target, []))
    matched["seniority"] = seniority_hit
    if seniority_hit: score += 5
    elif not target or target == "unspecified": 
        score += 5 # Neutral

    # Completeness (5pts)
    has_all = all([profile.get("title"), profile.get("company"),
                   profile.get("bio") or profile.get("headline")])
    matched["complete"] = has_all
    if has_all: score += 5

    score = round(min(score, 100), 1)
    # Status threshold (70 is solid)
    status: Literal["fully_matched", "partially_matched"] = "fully_matched" if score >= 70 else "partially_matched"
    
    # Build human-readable reasoning
    reasons = []
    if matched["role"]: reasons.append("Role match")
    if matched["location"]: reasons.append("Location match")
    if kw_hits > 0: reasons.append(f"Keywords ({kw_hits})")
    
    reasoning = " | ".join(reasons) if reasons else "Partial match on signals"
    
    return ScoreResult(score=score, match_status=status,
                       matched_criteria=matched, reasoning=reasoning)
