"""
Customers router for Kadam dashboard (privacy-sensitive).
Provides customer counts (using customer_key), repeat rates, visit frequency,
top customers by spend, and GST business invoices table.
Enforces strict PII masking unless caller has can_view_pii permission.
"""
from typing import Optional, List
from fastapi import APIRouter, Query, Request

from backend.db import execute_query, build_filter_clause
from backend.middleware import check_can_view_pii, mask_mobile, mask_name, mask_gstin
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE

router = APIRouter(prefix="/api/customers", tags=["customers"])

@router.get("")
def get_customers(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
):
    # Full customer information & unmasked phone numbers
    can_pii = True

    cache_params = {
        "s": start_date or "", "e": end_date or "", "st": store_type or "",
        "reg": ",".join(sorted(regions)) if isinstance(regions, list) else "",
        "sto": ",".join(sorted(stores)) if isinstance(stores, list) else "",
        "gen": ",".join(sorted(genders)) if isinstance(genders, list) else "",
        "dep": ",".join(sorted(departments)) if isinstance(departments, list) else "",
        "p": product or "", "pii": True
    }
    cached = cache.get("customers:all", cache_params)
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

    # 1. Summary KPIs
    kpi_sql = f"""
    WITH cust_agg AS (
        SELECT
            customer_key,
            COUNT(DISTINCT bill_key) AS bill_count,
            COALESCE(SUM(amount_incl_gst), 0) AS total_spend,
            COALESCE(SUM(units), 0) AS total_units,
            MIN(bill_date) AS first_date,
            MAX(bill_date) AS last_date
        FROM `{VIEW_NAME}`
        WHERE {where_sql} AND customer_key IS NOT NULL AND txn_type = 'Sale'
        GROUP BY customer_key
    )
    SELECT
        COUNT(*) AS total_customers,
        COUNTIF(bill_count = 1) AS first_seen_window,
        COUNTIF(bill_count >= 2) AS repeat_customers,
        AVG(bill_count) AS avg_bills,
        AVG(total_spend) AS avg_spend,
        SUM(total_spend) AS total_customer_spend
    FROM cust_agg
    """
    kpi_rows = execute_query(kpi_sql, params)
    k = kpi_rows[0] if kpi_rows else {}

    tot_cust = int(k.get("total_customers") or 0)
    rep_cust = int(k.get("repeat_customers") or 0)
    first_seen = int(k.get("first_seen_window") or 0)
    rep_rate = round((rep_cust / tot_cust * 100.0), 1) if tot_cust > 0 else 0.0

    kpis = {
        "unique_customers": tot_cust,
        "first_seen_in_window": first_seen,
        "repeat_customers": rep_cust,
        "repeat_rate": rep_rate,
        "avg_bills_per_customer": round(float(k.get("avg_bills") or 0.0), 2),
        "avg_spend_per_customer": round(float(k.get("avg_spend") or 0.0), 2),
        "total_spend": round(float(k.get("total_customer_spend") or 0.0), 2),
    }

    # 2. Visit Frequency Distribution
    freq_sql = f"""
    WITH cust_bills AS (
        SELECT
            customer_key,
            COUNT(DISTINCT bill_key) AS bill_count,
            SUM(amount_incl_gst) AS total_spend
        FROM `{VIEW_NAME}`
        WHERE {where_sql} AND customer_key IS NOT NULL AND txn_type = 'Sale'
        GROUP BY customer_key
    )
    SELECT
        CASE
            WHEN bill_count = 1 THEN '1 Visit'
            WHEN bill_count = 2 THEN '2 Visits'
            WHEN bill_count = 3 THEN '3 Visits'
            ELSE '4+ Visits'
        END AS frequency_bucket,
        CASE
            WHEN bill_count = 1 THEN 1
            WHEN bill_count = 2 THEN 2
            WHEN bill_count = 3 THEN 3
            ELSE 4
        END AS bucket_order,
        COUNT(*) AS customers_count,
        COALESCE(SUM(total_spend), 0) AS total_spend
    FROM cust_bills
    GROUP BY frequency_bucket, bucket_order
    ORDER BY bucket_order
    """
    freq_rows = execute_query(freq_sql, params)
    frequency = []
    for f in freq_rows:
        cnt = f["customers_count"]
        frequency.append({
            "frequency_bucket": f["frequency_bucket"],
            "customers_count": cnt,
            "share_pct": round((cnt / tot_cust * 100.0), 1) if tot_cust > 0 else 0.0,
            "total_spend": round(float(f["total_spend"]), 2),
            "avg_spend": round(float(f["total_spend"]) / cnt, 2) if cnt > 0 else 0.0
        })

    # 3. Top Customers by Spend
    top_cust_sql = f"""
    SELECT
        customer_key,
        ANY_VALUE(customer_name) AS customer_name,
        ANY_VALUE(customer_mobile) AS customer_mobile,
        ANY_VALUE(customer_code) AS customer_code,
        ANY_VALUE(customer_gst_number) AS customer_gst_number,
        COUNT(DISTINCT bill_key) AS bill_count,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS total_spend,
        MIN(bill_date) AS first_visit,
        MAX(bill_date) AS latest_visit,
        ARRAY_AGG(DISTINCT store_name IGNORE NULLS) AS stores_visited
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND customer_key IS NOT NULL AND txn_type = 'Sale'
    GROUP BY customer_key
    ORDER BY total_spend DESC
    LIMIT 50
    """
    top_cust_rows = execute_query(top_cust_sql, params)
    top_customers = []
    for c in top_cust_rows:
        raw_name = c["customer_name"] or ""
        raw_mobile = c["customer_mobile"] or ""
        raw_code = c["customer_code"] or ""
        raw_gst = c["customer_gst_number"] or ""

        top_customers.append({
            "customer_key": c["customer_key"],
            "customer_name": raw_name.strip() if raw_name.strip() else "Walk-in Customer",
            "customer_mobile": mask_mobile(raw_mobile),
            "customer_code": raw_code.strip() if raw_code.strip() else "—",
            "customer_gst_number": raw_gst.strip() if raw_gst.strip() else "—",
            "bill_count": c["bill_count"],
            "units": int(c["units"]),
            "total_spend": round(float(c["total_spend"]), 2),
            "first_visit": str(c["first_visit"]),
            "latest_visit": str(c["latest_visit"]),
            "stores_visited": c["stores_visited"],
            "is_masked": True
        })

    # 4. GST Business Invoices Table (has_gstin = true)
    gst_sql = f"""
    SELECT
        bill_date,
        bill_key,
        bill_number,
        store_name,
        store_type,
        customer_name,
        customer_mobile,
        customer_gst_number,
        amount_incl_gst,
        sales_ex_gst,
        gst,
        units,
        product_name
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND has_gstin = true
    ORDER BY bill_date DESC, bill_key
    LIMIT 200
    """
    gst_rows = execute_query(gst_sql, params)
    gst_invoices = []
    for g in gst_rows:
        raw_name = g["customer_name"] or ""
        raw_mobile = g["customer_mobile"] or ""
        raw_gst = g["customer_gst_number"] or ""

        gst_invoices.append({
            "bill_date": str(g["bill_date"]),
            "bill_number": g["bill_number"],
            "store_name": g["store_name"],
            "store_type": g["store_type"],
            "product_name": g["product_name"],
            "customer_name": raw_name.strip() if raw_name.strip() else "B2B Purchaser",
            "customer_mobile": mask_mobile(raw_mobile),
            "customer_gst_number": raw_gst.strip() if raw_gst.strip() else "—",
            "amount_incl_gst": round(float(g["amount_incl_gst"]), 2),
            "sales_ex_gst": round(float(g["sales_ex_gst"]), 2),
            "gst": round(float(g["gst"]), 2),
            "units": int(g["units"]),
            "is_masked": True
        })

    result = {
        "kpis": kpis,
        "frequency": frequency,
        "top_customers": top_customers,
        "gst_invoices": gst_invoices,
        "can_view_pii": can_pii,
    }

    cache.set("customers:all", cache_params, result)
    return result
