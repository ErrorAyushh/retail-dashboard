"""
Cache Warm-up Router for Kadam Dashboard.
Provides POST /api/warmup protected strictly by X-Warmup-Secret header.
Fills the exact same cache keys used by real user requests.
"""
import logging
import traceback
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, status

from backend.config import WARMUP_SECRET
from backend.routers import (
    overview,
    stores,
    geography,
    products,
    discounts,
    returns,
    staff,
    customers
)

logger = logging.getLogger("kadam.warmup")

router = APIRouter(prefix="/api/warmup", tags=["warmup"])

@router.post("", response_model=Dict[str, Any])
def trigger_cache_warmup(request: Request):
    """
    Executes pre-warming of critical dashboard queries and cache keys.
    Must be called via POST with X-Warmup-Secret header.
    Returns ok_count and fail_count; raises 500 if any task fails.
    """
    # 1. Validation: 503 if WARMUP_SECRET is not configured
    if not WARMUP_SECRET:
        logger.error("Warmup request rejected: WARMUP_SECRET is not set in environment.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Warm-up service is not configured (WARMUP_SECRET is unset)."
        )

    # 2. Validation: 403 if header is missing or incorrect
    client_secret = request.headers.get("X-Warmup-Secret")
    if client_secret != WARMUP_SECRET:
        logger.warning("Unauthorized warm-up attempt with invalid or missing X-Warmup-Secret header.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing warm-up secret header."
        )

    ok_count = 0
    fail_count = 0
    errors = []

    warmup_tasks = [
        ("overview", lambda: overview.get_overview(
            request=request, start_date=None, end_date=None, store_type="All",
            regions=None, stores=None, genders=None, departments=None, product=None, compare=True
        )),
        ("stores", lambda: stores.get_stores_ranking(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None
        )),
        ("geography", lambda: geography.get_geography_data(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None, mature_only=False
        )),
        ("products", lambda: products.get_products(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None, group_by="product"
        )),
        ("discounts", lambda: discounts.get_discounts(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None
        )),
        ("returns", lambda: returns.get_returns(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None
        )),
        ("staff", lambda: staff.get_staff_leaderboard(
            start_date=None, end_date=None, store_type="All", regions=None,
            stores=None, genders=None, departments=None, product=None, min_bills=0, include_unassigned=True
        )),
        ("customers", lambda: customers.get_customers(
            request=request, start_date=None, end_date=None, store_type="All",
            regions=None, stores=None, genders=None, departments=None, product=None
        )),
    ]

    for name, task_fn in warmup_tasks:
        try:
            logger.info(f"Warming up cache for endpoint: {name}...")
            task_fn()
            ok_count += 1
            logger.info(f"Warmup succeeded for {name}")
        except Exception as e:
            fail_count += 1
            tb = traceback.format_exc()
            logger.error(f"Warmup failed for {name}: {e}\n{tb}")
            errors.append({"endpoint": name, "error": str(e), "traceback": tb})

    if fail_count > 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": f"Warmup completed with {fail_count} failure(s).",
                "ok_count": ok_count,
                "fail_count": fail_count,
                "errors": errors
            }
        )

    return {
        "status": "warmup_completed",
        "ok_count": ok_count,
        "fail_count": 0
    }
