"""
Cache Module for Kadam API
In-memory TTL cache with support for serialized responses and cache keys based on normalized query parameters.
"""
import time
import json
import hashlib
from typing import Any, Optional, Dict
from backend.config import CACHE_TTL_SECONDS

class SimpleTTLCache:
    def __init__(self, default_ttl: int = CACHE_TTL_SECONDS):
        self.default_ttl = default_ttl
        self._store: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        # Normalize params: sort keys and cast values to strings
        normalized = {k: str(v) for k, v in sorted(params.items()) if v is not None}
        payload = f"{endpoint}:{json.dumps(normalized, sort_keys=True)}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get(self, endpoint: str, params: Dict[str, Any]) -> Optional[Any]:
        key = self._make_key(endpoint, params)
        entry = self._store.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._store[key]
            return None
        return entry["data"]

    def set(self, endpoint: str, params: Dict[str, Any], data: Any, ttl: Optional[int] = None) -> None:
        key = self._make_key(endpoint, params)
        expires_at = time.time() + (ttl or self.default_ttl)
        self._store[key] = {
            "expires_at": expires_at,
            "data": data
        }

    def clear(self) -> None:
        self._store.clear()

cache = SimpleTTLCache()
