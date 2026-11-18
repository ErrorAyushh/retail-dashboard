"""
Stores router for Kadam dashboard.
Provides store ranking table with complete retail metrics, store x day performance matrix,
network rank scorecards, and store deep-dive details.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Query, HTTPException

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE

router = APIRouter(prefix="/api/stores", tags=["stores"])

@router.get("")
def get_stores_ranking(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
):
    cache_params = {
        "s": start_date or "", "e": end_date or "", "st": store_type or "",
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or ""
    }
    cached = cache.get("stores:ranking_v3", cache_params)
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
        store_name,
        MAX(store_code) AS store_code,
        MAX(region) AS region,
        MAX(store_type) AS store_type,
        COUNT(DISTINCT bill_date) AS days_with_sales,
        ARRAY_AGG(
            STRUCT(bill_date, amount_incl_gst)
        ) AS raw_sales,
        {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_name
    ORDER BY net_sales_incl_gst DESC
    """
    rows = execute_query(sql, params)

    total_net_sales = sum(r["net_sales_incl_gst"] for r in rows) or 1.0
    total_bills = sum(r.get("bills", 0) for r in rows) or 1
    total_units = sum(r.get("sale_units", 0) for r in rows) or 1

    network_avg_aov = round(total_net_sales / total_bills, 2)
    network_avg_upt = round(total_units / total_bills, 2)

    ranked_stores = []
    for r in rows:
        derived = compute_derived_metrics(r)
        share_pct = round((derived["net_sales_incl_gst"] / total_net_sales) * 100.0, 2)

        # Extract daily sparkline
        daily_dict = {}
        for entry in r.get("raw_sales") or []:
            b_date = str(entry["bill_date"])
            daily_dict[b_date] = daily_dict.get(b_date, 0.0) + (entry["amount_incl_gst"] or 0.0)
        sorted_dates = sorted(daily_dict.keys())
        sparkline = [round(daily_dict[d], 2) for d in sorted_dates]

        ranked_stores.append({
            "store_name": r["store_name"],
            "store_code": r["store_code"],
            "region": r["region"],
            "store_type": r["store_type"],
            "days_with_sales": r["days_with_sales"],
            "share_pct": share_pct,
            "sparkline": sparkline,
            **derived
        })

    # Compute network rankings for each store
    n_stores = len(ranked_stores)
    # Sorts for rankings
    by_sales = sorted(ranked_stores, key=lambda x: x["net_sales_incl_gst"], reverse=True)
    by_margin = sorted(ranked_stores, key=lambda x: x["gross_margin_pct"], reverse=True)
    by_aov = sorted(ranked_stores, key=lambda x: x["aov"], reverse=True)
    by_upt = sorted(ranked_stores, key=lambda x: x["upt"], reverse=True)
    by_discount = sorted(ranked_stores, key=lambda x: x["discount_pct"]) # lowest discount is best
    by_returns = sorted(ranked_stores, key=lambda x: x["return_rate"])   # lowest return is best

    rank_lookup = {}
    for i, s in enumerate(by_sales):
        rank_lookup.setdefault(s["store_name"], {})["sales_rank"] = i + 1
    for i, s in enumerate(by_margin):
        rank_lookup[s["store_name"]]["margin_rank"] = i + 1
    for i, s in enumerate(by_aov):
        rank_lookup[s["store_name"]]["aov_rank"] = i + 1
    for i, s in enumerate(by_upt):
        rank_lookup[s["store_name"]]["upt_rank"] = i + 1
    for i, s in enumerate(by_discount):
        rank_lookup[s["store_name"]]["discount_rank"] = i + 1
    for i, s in enumerate(by_returns):
        rank_lookup[s["store_name"]]["return_rank"] = i + 1

    for s in ranked_stores:
        s["ranks"] = rank_lookup.get(s["store_name"], {})
        s["ranks"]["total_stores"] = n_stores

    result = {
        "stores": ranked_stores,
        "total_stores": len(ranked_stores),
        "total_network_sales": round(total_net_sales, 2),
        "network_benchmarks": {
            "avg_aov": network_avg_aov,
            "avg_upt": network_avg_upt
        }
    }

    cache.set("stores:ranking_v3", cache_params, result)
    return result

@router.get("/heatmap")
def get_store_day_heatmap(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
):
    """
    Returns store x day matrix indexed against each store's own daily average.
    """
    try:
        e_dt = datetime.fromisoformat(end_date).date() if end_date else date(2026, 11, 17)
    except Exception:
        e_dt = date(2026, 11, 17)

    # If single-day filter (e.g. Yesterday), expand heatmap window to start of the active month
    # so the heatmap shows full month-to-date trajectory
    if not start_date or start_date == end_date:
        effective_start = f"{e_dt.year:04d}-{e_dt.month:02d}-01"
    else:
        effective_start = start_date
    effective_end = e_dt.isoformat()

    cache_params = {
        "s": effective_start, "e": effective_end, "st": store_type or "",
        "reg": ",".join(sorted(regions)) if regions else ""
    }
    cached = cache.get("stores:heatmap_v2", cache_params)
    if cached:
        return cached

    where_sql, params = build_filter_clause(
        start_date=effective_start,
        end_date=effective_end,
        store_type=store_type,
        regions=regions
    )

    sql = f"""
    SELECT
        store_name,
        MAX(store_type) AS store_type,
        bill_date,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_name, bill_date
    ORDER BY store_name, bill_date
    """
    rows = execute_query(sql, params)

    # Generate continuous list of dates
    try:
        s_dt = datetime.fromisoformat(effective_start).date()
    except Exception:
        s_dt = date(e_dt.year, e_dt.month, 1)

    all_dates = []
    curr_d = s_dt
    while curr_d <= e_dt:
        all_dates.append(curr_d.isoformat())
        curr_d += timedelta(days=1)

    # Group by store and calculate daily average per store
    stores_data = {}
    for r in rows:
        s_name = r["store_name"]
        b_date = str(r["bill_date"])
        if s_name not in stores_data:
            stores_data[s_name] = {
                "store_name": s_name,
                "store_type": r["store_type"],
                "daily": {},
                "total_sales": 0.0,
            }
        stores_data[s_name]["daily"][b_date] = round(r["net_sales"], 2)
        stores_data[s_name]["total_sales"] += r["net_sales"]

    matrix = []
    total_days = max(len(all_dates), 1)
    for s_name, s_info in stores_data.items():
        avg_sales = s_info["total_sales"] / total_days
        cells = []
        for d in all_dates:
            sales = s_info["daily"].get(d, 0.0)
            ratio = round(sales / avg_sales, 2) if avg_sales > 0 else 0.0
            cells.append({
                "date": d,
                "sales": sales,
                "ratio": ratio,
                "status": "dormant" if sales <= 0 else "weak" if ratio < 0.8 else "strong" if ratio >= 1.3 else "normal"
            })
        matrix.append({
            "store_name": s_name,
            "store_type": s_info["store_type"],
            "avg_sales": round(avg_sales, 2),
            "total_sales": round(s_info["total_sales"], 2),
            "cells": cells
        })

    # Sort stores by total sales descending
    matrix.sort(key=lambda x: x["total_sales"], reverse=True)

    result = {
        "dates": all_dates,
        "stores": matrix
    }
    cache.set("stores:heatmap_v2", cache_params, result)
    return result

@router.get("/{store_name}")
def get_store_detail(
    store_name: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    cache_params = {"store": store_name, "s": start_date or "", "e": end_date or ""}
    cached = cache.get("stores:detail_v2", cache_params)
    if cached:
        return cached

    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        stores=[store_name]
    )

    metric_aggs = get_sql_metric_aggregates()

    # 1. Summary KPI
    kpi_sql = f"""
    SELECT {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    """
    kpi_rows = execute_query(kpi_sql, params)
    kpis = compute_derived_metrics(kpi_rows[0]) if kpi_rows else {}

    # 2. Daily trend
    daily_sql = f"""
    SELECT
        bill_date,
        FORMAT_DATE('%a', bill_date) AS weekday,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(units), 0) AS units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY bill_date, weekday
    ORDER BY bill_date
    """
    daily = execute_query(daily_sql, params)

    # 3. Hourly distribution
    hourly_sql = f"""
    SELECT
        bill_hour,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY bill_hour
    ORDER BY bill_hour
    """
    hourly = execute_query(hourly_sql, params)

    # 4. Top products
    top_prod_sql = f"""
    SELECT
        product_name,
        product_code,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY product_name, product_code
    ORDER BY net_sales DESC
    LIMIT 10
    """
    top_products = execute_query(top_prod_sql, params)

    # 5. Size mix
    size_sql = f"""
    SELECT
        COALESCE(size, 'Unknown') AS size,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY size
    ORDER BY units DESC
    """
    size_mix = execute_query(size_sql, params)

    # 6. Staff performance
    staff_sql = f"""
    SELECT
        COALESCE(NULLIF(TRIM(salesman_name), ''), 'Unassigned') AS staff_name,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(units), 0) AS units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY staff_name
    ORDER BY net_sales DESC
    """
    staff = execute_query(staff_sql, params)

    # 7. Return reasons
    reasons_sql = f"""
    SELECT
        COALESCE(NULLIF(TRIM(reason), ''), 'Not specified') AS reason,
        ABS(COALESCE(SUM(amount_incl_gst), 0)) AS return_amount,
        ABS(COALESCE(SUM(units), 0)) AS return_units,
        COUNT(*) AS return_lines
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND txn_type = 'Return'
    GROUP BY reason
    ORDER BY return_amount DESC
    """
    reasons = execute_query(reasons_sql, params)

    result = {
        "store_name": store_name,
        "kpis": kpis,
        "daily": daily,
        "hourly": hourly,
        "top_products": top_products,
        "size_mix": size_mix,
        "staff": staff,
        "return_reasons": reasons
    }

    cache.set("stores:detail_v2", cache_params, result)
    return result
