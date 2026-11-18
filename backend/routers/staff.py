"""
Staff router for Kadam dashboard.
Provides salesman leaderboard with net sales, bills, UPT, AOV, discount %, return rate,
and stores worked. Supports configurable minimum bills threshold (default 20).
Groups blank salesman rows as "Unassigned".
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Query

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE, INSIGHT_THRESHOLDS

router = APIRouter(prefix="/api/staff", tags=["staff"])

@router.get("")
def get_staff_leaderboard(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    min_bills: Optional[int] = Query(None),
    include_unassigned: Optional[bool] = Query(True),
):
    if min_bills is None:
        if start_date and end_date:
            try:
                s_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                e_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                days = (e_dt - s_dt).days + 1
            except Exception:
                days = 30
        else:
            days = 1

        if days <= 1:
            effective_min_bills = 1
        elif days <= 7:
            effective_min_bills = 5
        elif days <= 14:
            effective_min_bills = 10
        else:
            effective_min_bills = 20
    else:
        effective_min_bills = max(0, min_bills)

    cache_params = {
        "s": start_date or "", "e": end_date or "", "st": store_type or "",
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or "", "mb": effective_min_bills, "iu": include_unassigned
    }
    cached = cache.get("staff:leaderboard", cache_params)
    if cached:
        return cached

    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
    )

    metric_aggs = get_sql_metric_aggregates()

    sql = f"""
    SELECT
        COALESCE(NULLIF(TRIM(salesman_name), ''), 'Unassigned') AS salesman_name,
        ARRAY_AGG(DISTINCT store_name IGNORE NULLS) AS stores_worked,
        COUNT(DISTINCT store_name) AS stores_count,
        {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY salesman_name
    ORDER BY net_sales_incl_gst DESC
    """
    rows = execute_query(sql, params)

    total_net_sales = sum(r["net_sales_incl_gst"] for r in rows) or 1.0

    leaderboard = []
    unassigned_row = None

    for r in rows:
        name = r["salesman_name"]
        derived = compute_derived_metrics(r)
        bills = derived["bills"]

        row_item = {
            "salesman_name": name,
            "stores_worked": r["stores_worked"],
            "stores_count": r["stores_count"],
            "share_pct": round((derived["net_sales_incl_gst"] / total_net_sales) * 100.0, 1),
            **derived
        }

        if name == "Unassigned":
            unassigned_row = row_item
        else:
            if bills >= effective_min_bills:
                leaderboard.append(row_item)

    # If include_unassigned is True and unassigned exists, we can include it at the end or separate
    result = {
        "leaderboard": leaderboard,
        "unassigned": unassigned_row,
        "min_bills_threshold": effective_min_bills,
        "total_ranked_staff": len(leaderboard),
        "total_network_sales": round(total_net_sales, 2)
    }

    cache.set("staff:leaderboard", cache_params, result)
    return result
