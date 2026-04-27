import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# Simple in-memory KV store
_store: dict[str, dict] = {}

# Namespaces and their TTLs in hours
TTLS = {
    "tavily": 72,          # hours — web content stays fresh 3 days
    "search_results": 6,    # hours — leads for same criteria
    "criteria": 4,          # hours — supervisor output for same query
}

def _key(namespace: str, data: Any) -> str:
    """Generate a cache key based on namespace and a hash of the input data."""
    if isinstance(data, dict):
        raw = json.dumps(data, sort_keys=True)
    else:
        raw = str(data)
    
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{namespace}:{h}"

def get(namespace: str, data: Any) -> Any | None:
    """Retrieve a value from the cache if it hasn't expired."""
    k = _key(namespace, data)
    entry = _store.get(k)
    
    if not entry:
        return None
        
    if datetime.utcnow() > entry["exp"]:
        logger.debug(f"Cache expired for {k}")
        del _store[k]
        return None
        
    logger.debug(f"Cache hit for {k}")
    return entry["val"]

def set(namespace: str, data: Any, value: Any):
    """Store a value in the cache with a predefined TTL."""
    k = _key(namespace, data)
    ttl = TTLS.get(namespace, 6) # Default 6 hours
    
    _store[k] = {
        "val": value,
        "exp": datetime.utcnow() + timedelta(hours=ttl)
    }
    logger.debug(f"Cache set for {k} (TTL={ttl}h)")

def clear_namespace(namespace: str):
    """Clear all keys in a specific namespace."""
    keys_to_del = [k for k in _store if k.startswith(f"{namespace}:")]
    for k in keys_to_del:
        del _store[k]

def stats() -> dict:
    """Return cache usage statistics."""
    namespaces = {}
    for k in _store:
        ns = k.split(":")[0]
        namespaces[ns] = namespaces.get(ns, 0) + 1
        
    return {
        "total_active_keys": len(_store),
        "namespaces": namespaces
    }
