import logging
from typing import Any
from app.agents.state import NexusState

logger = logging.getLogger(__name__)

def evaluate_node(state: NexusState) -> dict[str, Any]:
    """
    Evaluates the current results. If lead count is low, triggers a retry loop
    by suggesting a broader plan for the supervisor.
    """
    leads = state.get("leads", [])
    retry_count = state.get("retry_count", 0)
    
    # We want at least 3 strong leads.
    LEAD_THRESHOLD = 3
    MAX_RETRIES = 2
    
    event = {
        "type": "evaluate",
        "message": f"Evaluating results ({len(leads)} found)...",
        "data": {"count": len(leads), "retry": retry_count}
    }
    
    if len(leads) < LEAD_THRESHOLD and retry_count < MAX_RETRIES:
        logger.info(f"Low lead count ({len(leads)}). Retrying search. Attempt {retry_count + 1}")
        return {
            "retry_count": retry_count + 1,
            "events": [event, {
                "type": "searching",
                "message": "Quality below threshold. Refining strategy and retrying...",
                "data": {"mode": "retry"}
            }]
        }

    # If results are sufficient or we've exhausted retries, finish.
    return {
        "events": [event]
    }
