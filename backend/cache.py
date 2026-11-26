"""
Cache Module for Kadam API.
In-memory TTL cache with support for data_version cache keys and X-Cache tracking.
"""
import time
import json
import hashlib
from typing import Any, Optional, Dict
from fastapi import Request
from backend.config import CACHE_TTL_SECONDS

class SimpleTTLCache:
    def __init__(self, default_ttl: int = CACHE_TTL_SECONDS):
        self.default_ttl = default_ttl
        self._store: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, endpoint: str, params: Dict[str, Any], data_version: str = "") -> str:
        # Normalize params: sort keys and cast values to strings
        normalized = {k: str(v) for k, v in sorted(params.items()) if v is not None}
        payload = f"{endpoint}:{data_version}:{json.dumps(normalized, sort_keys=True)}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get(
        self,
        endpoint: str,
        params: Dict[str, Any],
        data_version: str = "",
        request: Optional[Request] = None
    ) -> Optional[Any]:
        key = self._make_key(endpoint, params, data_version)
        entry = self._store.get(key)
        if not entry:
            if request is not None:
                request.state.cache_hit = False
            return None
        if time.time() > entry["expires_at"]:
            del self._store[key]
            if request is not None:
                request.state.cache_hit = False
            return None

        if request is not None:
            request.state.cache_hit = True
        return entry["data"]

    def set(
        self,
        endpoint: str,
        params: Dict[str, Any],
        data: Any,
        ttl: Optional[int] = None,
        data_version: str = "",
        request: Optional[Request] = None
    ) -> None:
        key = self._make_key(endpoint, params, data_version)
        expires_at = time.time() + (ttl or self.default_ttl)
        self._store[key] = {
            "expires_at": expires_at,
            "data": data
        }
        if request is not None and not hasattr(request.state, "cache_hit"):
            request.state.cache_hit = False

    def clear(self) -> None:
        self._store.clear()

cache = SimpleTTLCache()
