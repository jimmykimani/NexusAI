import logging
from typing import Any
from app.agents.state import NexusState
from app.services.llm import llm_chat

logger = logging.getLogger(__name__)

async def research_node(state: NexusState) -> dict[str, Any]:
    """
    Optional enrichment node. Performs deep research on relevant companies 
    found in the search stage.
    """
    leads = state.get("leads", [])
    if not leads:
        return {}

    # Select top 2 unique companies to research (don't over-bill)
    companies = list(set([l.get("company") for l in leads if l.get("company")]))[:2]
    
    events = [
        {
            "type": "searching",
            "message": f"Performing deep research on {', '.join(companies)}...",
            "data": {"companies": companies}
        }
    ]
    
    research_notes = []
    for co in companies:
        try:
            # In a real setup, this might hit a specific company scraper.
            # Here we simulate with an LLM-based general knowledge fetch.
            prompt = (
                f"Provide a 2-sentence professional summary of the company '{co}'. "
                "Focus on their industry position and recent known focus."
            )
            note = llm_chat(
                system="You are a corporate research assistant.",
                user=prompt,
                tier="fast"
            )
            research_notes.append({"company": co, "note": note})
        except Exception:
            logger.warning(f"Research failed for {co}")

    return {
        "research_results": research_notes,
        "events": events
    }
