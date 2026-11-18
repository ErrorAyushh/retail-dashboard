"""
Geography and Store Location Module for Kadam Dashboard.
Loads static store geography configuration, maps stores to city/state/zone/lat/lng,
handles unmapped store validation, and flags new stores.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("kadam.geo")

CONFIG_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "config", "store_geo.json")
)

_STORE_GEO_CACHE: Optional[Dict[str, Dict[str, Any]]] = None

def load_store_geo() -> Dict[str, Dict[str, Any]]:
    """Loads store_geo.json from the repository config directory."""
    global _STORE_GEO_CACHE
    if _STORE_GEO_CACHE is not None:
        return _STORE_GEO_CACHE

    if not os.path.exists(CONFIG_PATH):
        logger.error(f"store_geo.json not found at {CONFIG_PATH}")
        return {}

    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            _STORE_GEO_CACHE = json.load(f)
            logger.info(f"Loaded {len(_STORE_GEO_CACHE)} stores from store_geo.json")
            return _STORE_GEO_CACHE
    except Exception as e:
        logger.error(f"Failed to load store_geo.json: {e}")
        return {}

def get_store_geo(store_name: str) -> Dict[str, Any]:
    """
    Returns geographical metadata for a store_name.
    If unmapped, returns safe fallback values under 'Unmapped'.
    """
    stores = load_store_geo()
    if store_name in stores:
        return stores[store_name]
    
    return {
        "display_name": store_name,
        "city": "Unmapped",
        "state": "Unmapped",
        "zone": "Unmapped",
        "store_type": "Unknown",
        "lat": None,
        "lng": None,
        "unmapped": True
    }

def validate_stores(data_stores: List[str]) -> List[str]:
    """
    Checks that every store_name in the data exists in store_geo.json.
    Returns any store_name not found in the config.
    """
    geo_map = load_store_geo()
    unmapped = [s for s in data_stores if s and s not in geo_map]
    if unmapped:
        logger.warning(f"Unmapped stores detected ({len(unmapped)}): {unmapped}")
    return unmapped

NEW_STORE_CUTOFF_DATE = "2026-10-13"

def is_new_store(first_bill_date: Optional[str]) -> bool:
    """Returns True if store first bill date is after 13 Oct 2026."""
    if not first_bill_date:
        return False
    return str(first_bill_date) > NEW_STORE_CUTOFF_DATE
