from pathlib import Path
from string import Template
import logging

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

def load_prompt(name: str, version: str = "v1", **variables) -> str:
    """
    Loads a prompt from a file and optionally performs template substitution.
    Files are expected at backend/prompts/{name}_{version}.txt
    """
    if not PROMPTS_DIR.exists():
        PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
        
    path = PROMPTS_DIR / f"{name}_{version}.txt"
    try:
        if not path.exists():
            # If the file doesn't exist, we'll return a placeholder or log error
            logger.error(f"Prompt file not found: {path}")
            return f"Prompt {name} (v{version}) not found."
            
        raw = path.read_text().strip()
        if variables:
            return Template(raw).safe_substitute(**variables)
        return raw
    except Exception as e:
        logger.exception(f"Error loading prompt {name}: {e}")
        return f"Error loading prompt {name}."

def all_versions() -> dict[str, str]:
    """Returns {name: version} for every prompt file found."""
    result = {}
    if not PROMPTS_DIR.exists():
        return result
        
    for p in PROMPTS_DIR.glob("*_v*.txt"):
        parts = p.stem.rsplit("_", 1)
        if len(parts) == 2:
            result[parts[0]] = parts[1]
    return result
