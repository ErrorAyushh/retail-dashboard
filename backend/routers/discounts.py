"""
Discounts & Margin router for Kadam dashboard.
Provides discount depth buckets, discount type split (product, bill, other),
and ranking of highest-discount and lowest-margin stores and products.
"""
from typing import Optional, List
from fastapi import APIRouter, Query

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE

router = APIRouter(prefix="/api/discounts", tags=["discounts"])

@router.get("")
def get_discounts(
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
    cached = cache.get("discounts:all", cache_params)
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

    # 1. Discount Depth Buckets
    depth_sql = f"""
    WITH lines_with_depth AS (
        SELECT
            CASE
                WHEN mrp_value <= 0 OR discount <= 0 THEN '0 - 10%'
                WHEN (discount / mrp_value) * 100 < 10 THEN '0 - 10%'
                WHEN (discount / mrp_value) * 100 < 20 THEN '10 - 20%'
                WHEN (discount / mrp_value) * 100 < 30 THEN '20 - 30%'
                WHEN (discount / mrp_value) * 100 < 40 THEN '30 - 40%'
                WHEN (discount / mrp_value) * 100 < 50 THEN '40 - 50%'
                WHEN (discount / mrp_value) * 100 < 60 THEN '50 - 60%'
                ELSE '60%+'
            END AS bucket,
            CASE
                WHEN mrp_value <= 0 OR discount <= 0 THEN 0
                WHEN (discount / mrp_value) * 100 < 10 THEN 1
                WHEN (discount / mrp_value) * 100 < 20 THEN 2
                WHEN (discount / mrp_value) * 100 < 30 THEN 3
                WHEN (discount / mrp_value) * 100 < 40 THEN 4
                WHEN (discount / mrp_value) * 100 < 50 THEN 5
                WHEN (discount / mrp_value) * 100 < 60 THEN 6
                ELSE 7
            END AS bucket_order,
            units,
            discount,
            mrp_value,
            sales_ex_gst,
            amount_incl_gst,
            cost,
            gross_margin
        FROM `{VIEW_NAME}`
        WHERE {where_sql} AND txn_type = 'Sale'
    )
    SELECT
        bucket,
        bucket_order,
        COUNT(*) AS lines_count,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS sales_incl_gst,
        COALESCE(SUM(sales_ex_gst), 0) AS sales_ex_gst,
        COALESCE(SUM(discount), 0) AS discount,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM lines_with_depth
    GROUP BY bucket, bucket_order
    ORDER BY bucket_order
    """
    depth_rows = execute_query(depth_sql, params)
    buckets = []
    for r in depth_rows:
        sales_ex = float(r["sales_ex_gst"] or 0)
        margin = float(r["gross_margin"] or 0)
        margin_pct = round((margin / sales_ex * 100.0), 1) if sales_ex != 0 else 0.0
        buckets.append({
            "bucket": r["bucket"],
            "lines_count": r["lines_count"],
            "units": int(r["units"]),
            "sales_incl_gst": round(float(r["sales_incl_gst"]), 2),
            "sales_ex_gst": round(sales_ex, 2),
            "discount": round(float(r["discount"]), 2),
            "gross_margin": round(margin, 2),
            "margin_pct": margin_pct
        })

    # 2. Discount Component Split (product vs bill vs other)
    split_sql = f"""
    SELECT
        COALESCE(SUM(product_discount), 0) AS product_discount,
        COALESCE(SUM(bill_discount), 0) AS bill_discount,
        COALESCE(SUM(other_discount), 0) AS other_discount,
        COALESCE(SUM(discount), 0) AS total_discount
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND txn_type = 'Sale'
    """
    split_rows = execute_query(split_sql, params)
    split_data = split_rows[0] if split_rows else {}
    tot_disc = float(split_data.get("total_discount") or 1.0)
    
    prod_d = float(split_data.get("product_discount") or 0.0)
    bill_d = float(split_data.get("bill_discount") or 0.0)
    other_d = float(split_data.get("other_discount") or 0.0)

    components = [
        {"name": "Product Discount", "value": round(prod_d, 2), "share_pct": round((prod_d / tot_disc) * 100, 1), "color": "#4f46e5"},
        {"name": "Bill Discount", "value": round(bill_d, 2), "share_pct": round((bill_d / tot_disc) * 100, 1), "color": "#06b6d4"},
        {"name": "Other Discount", "value": round(other_d, 2), "share_pct": round((other_d / tot_disc) * 100, 1), "color": "#f59e0b"},
    ]

    # 3. Store Rankings: Highest Discount & Lowest Margin
    store_sql = f"""
    SELECT
        store_name,
        MAX(region) AS region,
        MAX(store_type) AS store_type,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales_incl_gst,
        COALESCE(SUM(sales_ex_gst), 0) AS net_sales_ex_gst,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN discount ELSE 0 END), 0) AS sale_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN mrp_value ELSE 0 END), 0) AS sale_mrp_value,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_name
    HAVING net_sales_incl_gst > 20000
    """
    store_rows = execute_query(store_sql, params)
    store_metrics = []
    for s in store_rows:
        mrp = float(s["sale_mrp_value"] or 0)
        disc = float(s["sale_discount"] or 0)
        sales_ex = float(s["net_sales_ex_gst"] or 0)
        margin = float(s["gross_margin"] or 0)

        disc_pct = round((disc / mrp * 100.0), 1) if mrp > 0 else 0.0
        margin_pct = round((margin / sales_ex * 100.0), 1) if sales_ex != 0 else 0.0

        store_metrics.append({
            "store_name": s["store_name"],
            "region": s["region"],
            "store_type": s["store_type"],
            "net_sales": round(float(s["net_sales_incl_gst"]), 2),
            "discount_pct": disc_pct,
            "margin_pct": margin_pct,
            "gross_margin": round(margin, 2)
        })

    highest_disc_stores = sorted(store_metrics, key=lambda x: x["discount_pct"], reverse=True)[:10]
    lowest_margin_stores = sorted(store_metrics, key=lambda x: x["margin_pct"])[:10]

    # 4. Product Rankings: Highest Discount & Lowest Margin (min 10 units)
    prod_sql = f"""
    SELECT
        product_name,
        product_code,
        MAX(department) AS department,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales_incl_gst,
        COALESCE(SUM(sales_ex_gst), 0) AS net_sales_ex_gst,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN discount ELSE 0 END), 0) AS sale_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN mrp_value ELSE 0 END), 0) AS sale_mrp_value,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY product_name, product_code
    HAVING units >= 10
    """
    prod_rows = execute_query(prod_sql, params)
    prod_metrics = []
    for p in prod_rows:
        mrp = float(p["sale_mrp_value"] or 0)
        disc = float(p["sale_discount"] or 0)
        sales_ex = float(p["net_sales_ex_gst"] or 0)
        margin = float(p["gross_margin"] or 0)

        disc_pct = round((disc / mrp * 100.0), 1) if mrp > 0 else 0.0
        margin_pct = round((margin / sales_ex * 100.0), 1) if sales_ex != 0 else 0.0

        prod_metrics.append({
            "product_name": p["product_name"],
            "product_code": p["product_code"],
            "department": p["department"],
            "units": int(p["units"]),
            "net_sales": round(float(p["net_sales_incl_gst"]), 2),
            "discount_pct": disc_pct,
            "margin_pct": margin_pct,
            "gross_margin": round(margin, 2)
        })

    highest_disc_products = sorted(prod_metrics, key=lambda x: x["discount_pct"], reverse=True)[:10]
    lowest_margin_products = sorted(prod_metrics, key=lambda x: x["margin_pct"])[:10]

    result = {
        "depth_buckets": buckets,
        "components": components,
        "highest_discount_stores": highest_disc_stores,
        "lowest_margin_stores": lowest_margin_stores,
        "highest_discount_products": highest_disc_products,
        "lowest_margin_products": lowest_margin_products,
    }

    cache.set("discounts:all", cache_params, result)
    return result
