"""
Returns & Exchanges router for Kadam dashboard.
Provides return rate trends, breakdowns by store/product/size/gender,
reason breakdown, exchange trends, and highest-return leaderboards.
"""
from typing import Optional, List
from fastapi import APIRouter, Query

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE

router = APIRouter(prefix="/api/returns", tags=["returns"])

@router.get("")
def get_returns(
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
    cached = cache.get("returns:all", cache_params)
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

    # 1. Summary KPIs for Returns & Exchanges
    summary_sql = f"""
    SELECT
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END), 0) AS gross_sales,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END), 0)) AS return_amount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS sale_units,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN units ELSE 0 END), 0)) AS return_units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Return' THEN bill_key END) AS return_bills,
        COALESCE(SUM(CASE WHEN txn_type = 'Exchange' THEN amount_incl_gst ELSE 0 END), 0) AS exchange_amount,
        COALESCE(SUM(CASE WHEN txn_type = 'Exchange' THEN units ELSE 0 END), 0) AS exchange_units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Exchange' THEN bill_key END) AS exchange_bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    """
    sum_rows = execute_query(summary_sql, params)
    s = sum_rows[0] if sum_rows else {}

    gross_s = float(s.get("gross_sales") or 0.0)
    ret_amt = float(s.get("return_amount") or 0.0)
    sale_u = float(s.get("sale_units") or 0.0)
    ret_u = float(s.get("return_units") or 0.0)

    summary = {
        "gross_sales": round(gross_s, 2),
        "return_amount": round(ret_amt, 2),
        "return_rate_val": round((ret_amt / gross_s * 100.0), 1) if gross_s > 0 else 0.0,
        "return_units": int(ret_u),
        "return_rate_units": round((ret_u / sale_u * 100.0), 1) if sale_u > 0 else 0.0,
        "return_bills": int(s.get("return_bills") or 0),
        "exchange_amount": round(float(s.get("exchange_amount") or 0.0), 2),
        "exchange_units": int(s.get("exchange_units") or 0),
        "exchange_bills": int(s.get("exchange_bills") or 0),
    }

    # 2. Daily Return & Exchange Trend
    trend_sql = f"""
    SELECT
        bill_date,
        FORMAT_DATE('%a', bill_date) AS weekday,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END), 0) AS gross_sales,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END), 0)) AS return_amount,
        COALESCE(SUM(CASE WHEN txn_type = 'Exchange' THEN amount_incl_gst ELSE 0 END), 0) AS exchange_amount,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN units ELSE 0 END), 0)) AS return_units,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS sale_units
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY bill_date, weekday
    ORDER BY bill_date
    """
    trend_rows = execute_query(trend_sql, params)
    daily_trend = []
    for t in trend_rows:
        gs = float(t["gross_sales"] or 0)
        ra = float(t["return_amount"] or 0)
        su = float(t["sale_units"] or 0)
        ru = float(t["return_units"] or 0)
        daily_trend.append({
            "bill_date": str(t["bill_date"]),
            "weekday": t["weekday"],
            "gross_sales": round(gs, 2),
            "return_amount": round(ra, 2),
            "exchange_amount": round(float(t["exchange_amount"] or 0), 2),
            "return_rate": round((ra / gs * 100.0), 1) if gs > 0 else 0.0,
            "return_rate_units": round((ru / su * 100.0), 1) if su > 0 else 0.0,
        })

    # 3. Return Reasons Breakdown
    reasons_sql = f"""
    SELECT
        COALESCE(NULLIF(TRIM(reason), ''), 'Not specified') AS reason,
        ABS(COALESCE(SUM(amount_incl_gst), 0)) AS return_amount,
        ABS(COALESCE(SUM(units), 0)) AS return_units,
        COUNT(*) AS lines_count
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND txn_type = 'Return'
    GROUP BY reason
    ORDER BY return_amount DESC
    """
    reasons_rows = execute_query(reasons_sql, params)
    tot_reasons_amt = sum(r["return_amount"] for r in reasons_rows) or 1
    reasons = []
    for r in reasons_rows:
        reasons.append({
            "reason": r["reason"],
            "return_amount": round(float(r["return_amount"]), 2),
            "return_units": int(r["return_units"]),
            "lines_count": r["lines_count"],
            "share_pct": round((r["return_amount"] / tot_reasons_amt) * 100.0, 1)
        })

    # 4. Returns by Size & Gender
    size_sql = f"""
    SELECT
        COALESCE(size, 'Unknown') AS size,
        COALESCE(gender, 'Unisex') AS gender,
        ABS(COALESCE(SUM(units), 0)) AS return_units,
        ABS(COALESCE(SUM(amount_incl_gst), 0)) AS return_amount
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND txn_type = 'Return'
    GROUP BY size, gender
    ORDER BY return_units DESC
    """
    size_returns = execute_query(size_sql, params)

    # 5. Highest Return Stores (min 20 forward sale units)
    high_store_sql = f"""
    SELECT
        store_name,
        MAX(region) AS region,
        MAX(store_type) AS store_type,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END), 0) AS gross_sales,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END), 0)) AS return_amount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS sale_units,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN units ELSE 0 END), 0)) AS return_units
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_name
    HAVING sale_units >= 20
    ORDER BY (return_amount / NULLIF(gross_sales, 0)) DESC
    LIMIT 10
    """
    high_stores_rows = execute_query(high_store_sql, params)
    highest_return_stores = []
    for hs in high_stores_rows:
        gs = float(hs["gross_sales"] or 0)
        ra = float(hs["return_amount"] or 0)
        highest_return_stores.append({
            "store_name": hs["store_name"],
            "region": hs["region"],
            "store_type": hs["store_type"],
            "gross_sales": round(gs, 2),
            "return_amount": round(ra, 2),
            "return_rate": round((ra / gs * 100.0), 1) if gs > 0 else 0.0,
            "return_units": int(hs["return_units"]),
            "sale_units": int(hs["sale_units"])
        })

    # 6. Highest Return Products (min 15 sale units)
    high_prod_sql = f"""
    SELECT
        product_name,
        product_code,
        MAX(department) AS department,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END), 0) AS gross_sales,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END), 0)) AS return_amount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS sale_units,
        ABS(COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN units ELSE 0 END), 0)) AS return_units
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY product_name, product_code
    HAVING sale_units >= 15
    ORDER BY (return_amount / NULLIF(gross_sales, 0)) DESC
    LIMIT 10
    """
    high_prods_rows = execute_query(high_prod_sql, params)
    highest_return_products = []
    for hp in high_prods_rows:
        gs = float(hp["gross_sales"] or 0)
        ra = float(hp["return_amount"] or 0)
        highest_return_products.append({
            "product_name": hp["product_name"],
            "product_code": hp["product_code"],
            "department": hp["department"],
            "gross_sales": round(gs, 2),
            "return_amount": round(ra, 2),
            "return_rate": round((ra / gs * 100.0), 1) if gs > 0 else 0.0,
            "return_units": int(hp["return_units"]),
            "sale_units": int(hp["sale_units"])
        })

    result = {
        "summary": summary,
        "daily_trend": daily_trend,
        "reasons": reasons,
        "size_returns": size_returns,
        "highest_return_stores": highest_return_stores,
        "highest_return_products": highest_return_products
    }

    cache.set("returns:all", cache_params, result)
    return result
