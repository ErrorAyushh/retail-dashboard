"""
Filters metadata router.
Provides available filter dimensions and date bounds for the top bar filter controls.
"""
import logging
from fastapi import APIRouter, Request
from backend.db import execute_query, get_max_date, get_data_version
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE, DATA_MIN_DATE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/filters", tags=["filters"])

REGION_CANONICAL_MAP = {
    "ANDHRA PRADESH": "Andhra Pradesh",
    "BIHAR": "Bihar",
    "CHHATTISGARH": "Chhattisgarh",
    "DELHI": "Delhi",
    "GOA": "Goa",
    "GUJARAT": "Gujarat",
    "HARYANA": "Haryana",
    "KARANATAKA": "Karnataka",
    "KARNATAKA": "Karnataka",
    "KERALA": "Kerala",
    "MADHYA PRADESH": "Madhya Pradesh",
    "MAHARASHTRA": "Maharashtra",
    "PUNJAB": "Punjab",
    "RAJASTHAN": "Rajasthan",
    "TELANGANA": "Telangana",
    "UTTAR PRADESH": "Uttar Pradesh",
    "UTTARAKHAND": "Uttarakhand",
    "WEST BENGAL": "West Bengal",
}

def normalize_region(name: str) -> str:
    if not name:
        return ""
    clean = str(name).strip()
    return REGION_CANONICAL_MAP.get(clean.upper(), clean.title())

@router.get("/meta")
def get_filters_metadata(request: Request):
    data_version = get_data_version()
    cached = cache.get("filters:meta_v2", {}, data_version=data_version, request=request)
    if cached:
        return cached

    sql = f"""
    SELECT
        MIN(bill_date) AS min_date,
        MAX(bill_date) AS max_date,
        MAX(pulled_at) AS max_pulled_at,
        ARRAY_AGG(DISTINCT region IGNORE NULLS ORDER BY region) AS regions,
        ARRAY_AGG(DISTINCT gender IGNORE NULLS ORDER BY gender) AS genders,
        ARRAY_AGG(DISTINCT department IGNORE NULLS ORDER BY department) AS departments
    FROM `{VIEW_NAME}`
    WHERE bill_date >= '{DATA_MIN_DATE}' AND bill_date <= CURRENT_DATE('Asia/Kolkata')
    """
    try:
        rows = execute_query(sql)
        meta = rows[0] if rows else {}
    except Exception as e:
        logger.error(f"Error executing filters metadata query: {e}")
        meta = {}

    stores_sql = f"""
    SELECT DISTINCT
        store_name,
        store_code,
        region,
        store_type
    FROM `{VIEW_NAME}`
    WHERE bill_date >= '{DATA_MIN_DATE}' AND bill_date <= CURRENT_DATE('Asia/Kolkata')
    ORDER BY store_name
    """
    try:
        stores_rows = execute_query(stores_sql)
    except Exception as e:
        logger.error(f"Error executing stores query: {e}")
        stores_rows = []

    effective_max = str(meta.get("max_date") or get_max_date())
    effective_min = str(meta.get("min_date") or DATA_MIN_DATE)
    if effective_min < DATA_MIN_DATE:
        effective_min = DATA_MIN_DATE

    # Normalize regions: deduplicate, clean uppercase/titlecase/misspellings, and sort alphabetically
    raw_regions = meta.get("regions") or []
    cleaned_regions_set = set()
    for r in raw_regions:
        norm = normalize_region(r)
        if norm:
            cleaned_regions_set.add(norm)
    cleaned_regions = sorted(list(cleaned_regions_set))

    # Also normalize region field in stores_rows
    for s in stores_rows:
        if s.get("region"):
            s["region"] = normalize_region(s["region"])

    result = {
        "min_date": effective_min,
        "max_date": effective_max,
        "max_pulled_at": str(meta.get("max_pulled_at") or ""),
        "regions": cleaned_regions,
        "genders": meta.get("genders") or [],
        "departments": meta.get("departments") or [],
        "stores": stores_rows,
        "default_store_type": DEFAULT_STORE_TYPE,
    }

    cache.set("filters:meta_v2", {}, result, data_version=data_version, request=request)
    return result
