"""
Products router for Kadam dashboard.
Provides best-sellers table (product and product x colour), size curve, gender/department splits,
MRP price-band mix, best product combos, and product x size matrix.
"""
import calendar
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Query

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE, DATA_MIN_DATE, DATA_MAX_DATE

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
def get_products(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    group_by: Optional[str] = Query("product"),  # "product" | "color"
):
    cache_params = {
        "s": start_date or "", "e": end_date or "", "st": store_type or "",
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or "", "gb": group_by
    }
    cached = cache.get("products:v2:all", cache_params)
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

    # 1. Best sellers table (grouped strictly by product_name or product_name x color)
    if group_by == "color":
        table_sql = f"""
        SELECT
            product_name,
            ANY_VALUE(product_code) AS product_code,
            COALESCE(NULLIF(TRIM(color), ''), 'Standard') AS color,
            MAX(department) AS department,
            MAX(gender) AS gender,
            COUNT(DISTINCT store_name) AS stores_selling,
            {metric_aggs}
        FROM `{VIEW_NAME}`
        WHERE {where_sql}
        GROUP BY product_name, color
        ORDER BY net_sales_incl_gst DESC
        """
    else:
        table_sql = f"""
        SELECT
            product_name,
            ANY_VALUE(product_code) AS product_code,
            MAX(department) AS department,
            MAX(gender) AS gender,
            COUNT(DISTINCT store_name) AS stores_selling,
            {metric_aggs}
        FROM `{VIEW_NAME}`
        WHERE {where_sql}
        GROUP BY product_name
        ORDER BY net_sales_incl_gst DESC
        """

    table_rows = execute_query(table_sql, params)
    best_sellers = []
    for r in table_rows:
        derived = compute_derived_metrics(r)
        item = {
            "product_name": r["product_name"],
            "product_code": r["product_code"],
            "department": r["department"],
            "gender": r["gender"],
            "stores_selling": r["stores_selling"],
            **derived
        }
        if group_by == "color":
            item["color"] = r["color"]
        best_sellers.append(item)

    # 2. Size curve (units by size and gender)
    size_sql = f"""
    SELECT
        COALESCE(size, 'Unknown') AS size,
        COALESCE(gender, 'Unisex') AS gender,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY size, gender
    ORDER BY size
    """
    size_rows = execute_query(size_sql, params)

    # 3. Gender split
    gender_sql = f"""
    SELECT
        COALESCE(gender, 'Unspecified') AS gender,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(units), 0) AS units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY gender
    ORDER BY net_sales DESC
    """
    gender_rows = execute_query(gender_sql, params)
    total_gender_sales = sum(r["net_sales"] for r in gender_rows) or 1
    for r in gender_rows:
        r["share_pct"] = round((r["net_sales"] / total_gender_sales) * 100.0, 1)

    # 4. Department split
    dept_sql = f"""
    SELECT
        COALESCE(department, 'Unspecified') AS department,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(units), 0) AS units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY department
    ORDER BY net_sales DESC
    """
    dept_rows = execute_query(dept_sql, params)
    total_dept_sales = sum(r["net_sales"] for r in dept_rows) or 1
    for r in dept_rows:
        r["share_pct"] = round((r["net_sales"] / total_dept_sales) * 100.0, 1)

    # 5. MRP price-band mix
    band_sql = f"""
    SELECT
        CASE
            WHEN mrp < 1000 THEN '< 1,000'
            WHEN mrp >= 1000 AND mrp < 2000 THEN '1,000 - 2,000'
            WHEN mrp >= 2000 AND mrp < 3000 THEN '2,000 - 3,000'
            WHEN mrp >= 3000 AND mrp < 5000 THEN '3,000 - 5,000'
            ELSE '5,000+'
        END AS price_band,
        COUNT(*) AS lines,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY price_band
    ORDER BY MIN(mrp)
    """
    band_rows = execute_query(band_sql, params)

    # 6. Best combos
    combos_sql = f"""
    WITH filtered_bills AS (
        SELECT bill_key
        FROM `{VIEW_NAME}`
        WHERE {where_sql} AND txn_type = 'Sale'
        GROUP BY bill_key
        HAVING COUNT(DISTINCT product_name) >= 2
    ),
    combos AS (
        SELECT
            b1.product_name AS item_a,
            b2.product_name AS item_b,
            COUNT(DISTINCT b1.bill_key) AS support_bills,
            SUM(b1.amount_incl_gst + b2.amount_incl_gst) AS total_combo_sales
        FROM `{VIEW_NAME}` b1
        JOIN `{VIEW_NAME}` b2
          ON b1.bill_key = b2.bill_key
         AND b1.product_name < b2.product_name
        WHERE b1.txn_type = 'Sale' AND b2.txn_type = 'Sale'
          AND b1.bill_key IN (SELECT bill_key FROM filtered_bills)
        GROUP BY item_a, item_b
    )
    SELECT *
    FROM combos
    ORDER BY support_bills DESC
    LIMIT 20
    """
    combos_rows = execute_query(combos_sql, params)

    result = {
        "best_sellers": best_sellers,
        "size_curve": size_rows,
        "gender_split": gender_rows,
        "department_split": dept_rows,
        "price_bands": band_rows,
        "best_combos": combos_rows,
        "group_by": group_by
    }

    cache.set("products:v2:all", cache_params, result)
    return result

@router.get("/heatmap")
def get_product_day_heatmap(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    group_by: Optional[str] = Query("product"),  # "product" | "sku"
):
    """
    Returns product x day DRR (Daily Run Rate) heatmap matrix across all products.
    Matches Monthly DRR Heatmap specification.
    """
    cache_params = {
        "s": start_date or "", "e": end_date or "", "st": store_type or "",
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or "", "gb": group_by or "product"
    }
    cached = cache.get("products:heatmap:drr", cache_params)
    if cached:
        return cached

    # Derive the active month boundaries
    try:
        e_dt = datetime.fromisoformat(end_date).date() if end_date else date(2026, 11, 17)
    except Exception:
        e_dt = date(2026, 11, 17)

    year = e_dt.year
    month = e_dt.month
    days_in_month = calendar.monthrange(year, month)[1]
    month_start_str = f"{year:04d}-{month:02d}-01"
    e_date_str = e_dt.isoformat()
    completed_days = min(e_dt.day, days_in_month)

    where_sql, params = build_filter_clause(
        start_date=month_start_str,
        end_date=e_date_str,
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
        prefix="heat"
    )

    if group_by == "sku":
        sql = f"""
        SELECT
            COALESCE(product_code, 'Unknown') AS product_key,
            MAX(product_name) AS product_name,
            MAX(department) AS department,
            MAX(gender) AS gender,
            EXTRACT(DAY FROM bill_date) AS day_num,
            bill_date,
            COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS units,
            COALESCE(SUM(amount_incl_gst), 0) AS net_sales
        FROM `{VIEW_NAME}`
        WHERE {where_sql}
        GROUP BY product_key, day_num, bill_date
        ORDER BY product_name, day_num
        """
    else:
        sql = f"""
        SELECT
            product_name AS product_key,
            product_name,
            ANY_VALUE(product_code) AS product_code,
            MAX(department) AS department,
            MAX(gender) AS gender,
            EXTRACT(DAY FROM bill_date) AS day_num,
            bill_date,
            COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS units,
            COALESCE(SUM(amount_incl_gst), 0) AS net_sales
        FROM `{VIEW_NAME}`
        WHERE {where_sql}
        GROUP BY product_name, day_num, bill_date
        ORDER BY product_name, day_num
        """

    rows = execute_query(sql, params)

    products_map = {}
    max_day_units = 1
    max_day_sales = 1.0

    for r in rows:
        pkey = r["product_key"]
        pname = r.get("product_name") or pkey
        pcode = r.get("product_code") or pkey
        day_num = int(r["day_num"])
        units = int(r["units"] or 0)
        sales = float(r["net_sales"] or 0.0)

        if pkey not in products_map:
            products_map[pkey] = {
                "key": pkey,
                "product_name": pname,
                "product_code": pcode,
                "department": r["department"] or "Footwear",
                "gender": r["gender"] or "Unisex",
                "days": {},
                "total_units": 0,
                "total_sales": 0.0,
            }

        products_map[pkey]["days"][day_num] = {
            "units": units,
            "sales": round(sales, 2),
            "date": str(r["bill_date"])
        }
        products_map[pkey]["total_units"] += units
        products_map[pkey]["total_sales"] += sales

        if units > max_day_units:
            max_day_units = units
        if sales > max_day_sales:
            max_day_sales = sales

    products_list = []
    for pkey, pinfo in products_map.items():
        tot_units = pinfo["total_units"]
        tot_sales = pinfo["total_sales"]
        avg_drr = round(tot_units / max(completed_days, 1), 2)
        avg_sales_drr = round(tot_sales / max(completed_days, 1), 2)
        products_list.append({
            "key": pkey,
            "product_name": pinfo["product_name"],
            "product_code": pinfo["product_code"],
            "department": pinfo["department"],
            "gender": pinfo["gender"],
            "total_units": tot_units,
            "total_sales": round(tot_sales, 2),
            "avg_drr": avg_drr,
            "avg_sales_drr": avg_sales_drr,
            "days": pinfo["days"]
        })

    # Sort descending by total units sold (as in reference image)
    products_list.sort(key=lambda x: x["total_units"], reverse=True)

    result = {
        "month_name": e_dt.strftime("%B %Y"),
        "year": year,
        "month": month,
        "days_in_month": days_in_month,
        "completed_days": completed_days,
        "max_day_units": max_day_units,
        "max_day_sales": round(max_day_sales, 2),
        "total_products": len(products_list),
        "products": products_list
    }

    cache.set("products:heatmap:drr", cache_params, result)
    return result

@router.get("/size-matrix")
def get_product_size_matrix(
    product_name: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    cache_params = {"pname": product_name, "s": start_date or "", "e": end_date or ""}
    cached = cache.get("products:matrix", cache_params)
    if cached:
        return cached

    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        product_search=product_name
    )

    sql = f"""
    SELECT
        COALESCE(color, 'Standard') AS color,
        COALESCE(size, 'Unknown') AS size,
        COALESCE(SUM(units), 0) AS units,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales
    FROM `{VIEW_NAME}`
    WHERE {where_sql} AND LOWER(product_name) = LOWER(@prod_exact)
    GROUP BY color, size
    ORDER BY color, size
    """
    from google.cloud import bigquery
    matrix_params = params + [bigquery.ScalarQueryParameter("prod_exact", "STRING", product_name.strip())]
    rows = execute_query(sql, matrix_params)

    # Transform into pivot matrix
    colors = sorted(list(set(r["color"] for r in rows)))
    sizes = sorted(list(set(r["size"] for r in rows)), key=lambda s: float(s) if s.replace('.', '', 1).isdigit() else 999)
    
    cell_map = {}
    for r in rows:
        cell_map[(r["color"], r["size"])] = {
            "units": int(r["units"]),
            "net_sales": round(float(r["net_sales"]), 2)
        }

    matrix = []
    for c in colors:
        row = {"color": c, "sizes": {}}
        for s in sizes:
            row["sizes"][s] = cell_map.get((c, s), {"units": 0, "net_sales": 0.0})
        matrix.append(row)

    result = {
        "product_name": product_name,
        "sizes": sizes,
        "colors": colors,
        "matrix": matrix
    }

    cache.set("products:matrix", cache_params, result)
    return result
