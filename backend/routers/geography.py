"""
Geography Router for Kadam Dashboard.
Provides rolled-up retail metrics across States, Cities, and Zones using store_geo.json.
Supports metric choropleths, city bubble coordinates, multi-store city comparisons,
growth contributions, state x week heatmaps, and rule-based insights.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, HTTPException

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics
from backend.cache import cache
from backend.config import VIEW_NAME, DEFAULT_STORE_TYPE, DATA_MIN_DATE, DATA_MAX_DATE
from backend.geo import load_store_geo, get_store_geo, validate_stores, is_new_store

router = APIRouter(prefix="/api/geography", tags=["geography"])

# Cached first bill dates for all stores to accurately identify new stores
_STORE_FIRST_DATES: Optional[Dict[str, str]] = None

def get_store_first_dates() -> Dict[str, str]:
    global _STORE_FIRST_DATES
    if _STORE_FIRST_DATES is not None:
        return _STORE_FIRST_DATES

    sql = f"""
    SELECT store_name, MIN(bill_date) AS first_bill_date
    FROM `{VIEW_NAME}`
    WHERE store_name IS NOT NULL
    GROUP BY store_name
    """
    rows = execute_query(sql)
    _STORE_FIRST_DATES = {r["store_name"]: str(r["first_bill_date"]) for r in rows}
    return _STORE_FIRST_DATES


@router.get("")
def get_geography_data(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    mature_only: bool = Query(False),
):
    """
    Returns complete geography rollup for states, cities, zones, and stores,
    including period deltas, growth contribution, multi-store comparisons, and insights.
    """
    # Handle direct function call vs FastAPI query injection
    s_date = start_date if (isinstance(start_date, str) and start_date) else DATA_MIN_DATE
    e_date = end_date if (isinstance(end_date, str) and end_date) else DATA_MAX_DATE
    st_val = store_type if isinstance(store_type, str) else DEFAULT_STORE_TYPE
    mat_only = bool(mature_only) if not hasattr(mature_only, "default") else False
    reg_list = regions if isinstance(regions, list) else None
    sto_list = stores if isinstance(stores, list) else None
    gen_list = genders if isinstance(genders, list) else None
    dep_list = departments if isinstance(departments, list) else None
    prd_val = product if isinstance(product, str) else None

    if s_date < DATA_MIN_DATE:
        s_date = DATA_MIN_DATE

    cache_params = {
        "s": s_date, "e": e_date, "st": st_val or "",
        "reg": ",".join(sorted(reg_list)) if reg_list else "",
        "sto": ",".join(sorted(sto_list)) if sto_list else "",
        "gen": ",".join(sorted(gen_list)) if gen_list else "",
        "dep": ",".join(sorted(dep_list)) if dep_list else "",
        "p": prd_val or "", "mo": str(mat_only)
    }
    cached = cache.get("geography:summary_v2", cache_params)
    if cached:
        return cached

    first_dates_map = get_store_first_dates()
    geo_config = load_store_geo()

    # 1. Build Current Period WHERE clause
    where_curr, params_curr = build_filter_clause(
        start_date=s_date,
        end_date=e_date,
        store_type=st_val,
        regions=reg_list,
        stores=sto_list,
        genders=gen_list,
        departments=dep_list,
        product_search=prd_val,
        prefix="curr"
    )

    # 2. Build Previous Period bounds (same day length)
    s_dt = datetime.strptime(s_date, "%Y-%m-%d").date()
    e_dt = datetime.strptime(e_date, "%Y-%m-%d").date()
    period_days = (e_dt - s_dt).days + 1

    prev_e_dt = s_dt - timedelta(days=1)
    prev_s_dt = prev_e_dt - timedelta(days=period_days - 1)
    prev_s_date = max(prev_s_dt.strftime("%Y-%m-%d"), DATA_MIN_DATE)
    prev_e_date = max(prev_e_dt.strftime("%Y-%m-%d"), DATA_MIN_DATE)

    where_prev, params_prev = build_filter_clause(
        start_date=prev_s_date,
        end_date=prev_e_date,
        store_type=st_val,
        regions=reg_list,
        stores=sto_list,
        genders=gen_list,
        departments=dep_list,
        product_search=prd_val,
        prefix="prev"
    )

    metric_aggs = get_sql_metric_aggregates()

    # Query Current Period grouped by store_name
    sql_curr = f"""
    SELECT
        store_name,
        MAX(store_code) AS store_code,
        MAX(store_type) AS raw_store_type,
        COUNT(DISTINCT bill_date) AS days_with_sales,
        ARRAY_AGG(STRUCT(bill_date, amount_incl_gst)) AS daily_sales,
        {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY store_name
    """
    rows_curr = execute_query(sql_curr, params_curr)

    # Query Previous Period grouped by store_name
    sql_prev = f"""
    SELECT
        store_name,
        {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_prev}
    GROUP BY store_name
    """
    rows_prev = execute_query(sql_prev, params_prev)
    prev_by_store = {r["store_name"]: compute_derived_metrics(r) for r in rows_prev}

    # Dedicated trailing 6-week query for State x Week Heatmap so momentum across weeks is always visible
    heat_s_dt = max(e_dt - timedelta(days=41), datetime.strptime(DATA_MIN_DATE, "%Y-%m-%d").date())
    heat_s_date = heat_s_dt.strftime("%Y-%m-%d")
    heat_where, heat_params = build_filter_clause(
        start_date=heat_s_date,
        end_date=e_date,
        store_type=st_val,
        regions=reg_list,
        prefix="heat"
    )
    sql_heatmap = f"""
    SELECT
        store_name,
        DATE_TRUNC(bill_date, WEEK(MONDAY)) AS week_start,
        COALESCE(SUM(amount_incl_gst), 0) AS week_net_sales
    FROM `{VIEW_NAME}`
    WHERE {heat_where}
    GROUP BY store_name, week_start
    ORDER BY week_start ASC
    """
    rows_heatmap = execute_query(sql_heatmap, heat_params)

    # Query Top 50 Products in this geography selection, grouped strictly by product_name
    sql_top_products = f"""
    SELECT
        product_name,
        COUNT(DISTINCT product_code) AS skus_count,
        COUNT(DISTINCT color) AS colors_count,
        MAX(gender) AS gender,
        COUNT(DISTINCT store_name) AS stores_selling,
        {metric_aggs}
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY product_name
    ORDER BY net_sales_incl_gst DESC
    LIMIT 50
    """
    rows_products = execute_query(sql_top_products, params_curr)

    # Dedicated 14-day daily sales query for sparklines
    trend_s_dt = e_dt - timedelta(days=13)
    trend_s_date = max(trend_s_dt.strftime("%Y-%m-%d"), DATA_MIN_DATE)
    trend_where, trend_params = build_filter_clause(
        start_date=trend_s_date,
        end_date=e_date,
        store_type=st_val,
        regions=reg_list,
        prefix="trend"
    )
    sql_trend = f"""
    SELECT
        store_name,
        bill_date,
        COALESCE(SUM(amount_incl_gst), 0) AS daily_sales
    FROM `{VIEW_NAME}`
    WHERE {trend_where}
    GROUP BY store_name, bill_date
    """
    rows_trend = execute_query(sql_trend, trend_params)
    store_trend_map = {}
    for tr in rows_trend:
        sn = tr["store_name"]
        if sn not in store_trend_map:
            store_trend_map[sn] = {}
        store_trend_map[sn][str(tr["bill_date"])] = tr["daily_sales"]

    trend_dates = []
    curr_t = trend_s_dt
    while curr_t <= e_dt:
        trend_dates.append(curr_t.strftime("%Y-%m-%d"))
        curr_t += timedelta(days=1)

    # Check unmapped stores
    current_store_names = [r["store_name"] for r in rows_curr]
    unmapped_stores = validate_stores(current_store_names)

    # Process stores with geo config
    processed_stores = []
    for r in rows_curr:
        s_name = r["store_name"]
        geo_info = get_store_geo(s_name)
        derived = compute_derived_metrics(r)
        prev_derived = prev_by_store.get(s_name, {})

        first_bill = first_dates_map.get(s_name, DATA_MIN_DATE)
        is_new = is_new_store(first_bill)

        # Extract 14-day continuous sparkline
        s_trend = store_trend_map.get(s_name, {})
        sparkline = [round(s_trend.get(d, 0.0), 2) for d in trend_dates]

        prev_sales = prev_derived.get("net_sales_incl_gst", 0.0)
        curr_sales = derived["net_sales_incl_gst"]
        sales_delta_pct = (
            round(((curr_sales - prev_sales) / prev_sales) * 100.0, 1)
            if prev_sales > 0 else 0.0
        )

        item = {
            "store_name": s_name,
            "display_name": geo_info.get("display_name", s_name),
            "store_code": r.get("store_code") or "",
            "store_type": geo_info.get("store_type") or r.get("raw_store_type"),
            "city": geo_info.get("city", "Unmapped"),
            "state": geo_info.get("state", "Unmapped"),
            "zone": geo_info.get("zone", "Unmapped"),
            "lat": geo_info.get("lat"),
            "lng": geo_info.get("lng"),
            "is_new": is_new,
            "first_bill_date": first_bill,
            "days_with_sales": r.get("days_with_sales", 0),
            "sparkline": sparkline,
            "prev_net_sales": prev_sales,
            "sales_delta_pct": sales_delta_pct,
            **derived
        }
        processed_stores.append(item)

    # Apply mature_only toggle if requested:
    # "excludes new stores from sales-per-store averages, rankings and insights"
    active_stores = [s for s in processed_stores if not (mat_only and s["is_new"])]

    # Compute Network Totals
    total_net_sales = sum(s["net_sales_incl_gst"] for s in active_stores) or 0.0
    total_prev_sales = sum(s["prev_net_sales"] for s in active_stores) or 0.0
    total_sales_delta = total_net_sales - total_prev_sales
    network_sales_delta_pct = (
        round((total_sales_delta / total_prev_sales) * 100.0, 1)
        if total_prev_sales > 0 else 0.0
    )
    total_bills = sum(s["bills"] for s in active_stores) or 0
    total_units = sum(s["sale_units"] for s in active_stores) or 0
    total_gross = sum(s["gross_sales"] for s in active_stores) or 0.0
    total_returns = sum(s["returns"] for s in active_stores) or 0.0
    total_mrp = sum(s.get("sale_mrp_value", 0.0) for s in active_stores) or 0.0
    total_discount = sum(s.get("sale_discount", 0.0) for s in active_stores) or 0.0
    total_margin = sum(s["gross_margin"] for s in active_stores) or 0.0
    total_ex_gst = sum(s["net_sales_ex_gst"] for s in active_stores) or 0.0

    network_aov = round(total_gross / total_bills, 2) if total_bills > 0 else 0.0
    network_upt = round(total_units / total_bills, 2) if total_bills > 0 else 0.0
    network_discount_pct = round((total_discount / total_mrp) * 100.0, 1) if total_mrp > 0 else 0.0
    network_margin_pct = round((total_margin / total_ex_gst) * 100.0, 1) if total_ex_gst > 0 else 0.0
    network_return_rate = round((total_returns / total_gross) * 100.0, 1) if total_gross > 0 else 0.0
    network_sales_per_store = round(total_net_sales / len(active_stores), 2) if active_stores else 0.0

    # 3. Rollup by State (Initialize all 16 states from config so none are missing)
    states_dict: Dict[str, Dict[str, Any]] = {}
    for sn, sinfo in geo_config.items():
        st = sinfo.get("state")
        z = sinfo.get("zone", "Unmapped")
        if st and st not in states_dict:
            states_dict[st] = {
                "state": st,
                "zone": z,
                "stores": [],
                "all_network_stores": [],
                "own_count": 0,
                "franchise_count": 0,
                "total_network_own": 0,
                "total_network_franchise": 0,
                "net_sales_incl_gst": 0.0,
                "net_sales_ex_gst": 0.0,
                "gross_sales": 0.0,
                "returns": 0.0,
                "bills": 0,
                "sale_units": 0,
                "sale_discount": 0.0,
                "sale_mrp_value": 0.0,
                "gross_margin": 0.0,
                "prev_net_sales": 0.0,
                "daily_sales": {}
            }
        if st:
            states_dict[st]["all_network_stores"].append(sn)
            st_type = sinfo.get("store_type", "")
            if "own" in st_type.lower():
                states_dict[st]["total_network_own"] += 1
            else:
                states_dict[st]["total_network_franchise"] += 1

    for s in active_stores:
        st = s["state"]
        if st not in states_dict:
            states_dict[st] = {
                "state": st,
                "zone": s["zone"],
                "stores": [],
                "all_network_stores": [],
                "own_count": 0,
                "franchise_count": 0,
                "total_network_own": 0,
                "total_network_franchise": 0,
                "net_sales_incl_gst": 0.0,
                "net_sales_ex_gst": 0.0,
                "gross_sales": 0.0,
                "returns": 0.0,
                "bills": 0,
                "sale_units": 0,
                "sale_discount": 0.0,
                "sale_mrp_value": 0.0,
                "gross_margin": 0.0,
                "prev_net_sales": 0.0,
                "daily_sales": {}
            }
        st_obj = states_dict[st]
        st_obj["stores"].append(s["store_name"])
        if "own" in s["store_type"].lower():
            st_obj["own_count"] += 1
        else:
            st_obj["franchise_count"] += 1
        st_obj["net_sales_incl_gst"] += s["net_sales_incl_gst"]
        st_obj["net_sales_ex_gst"] += s["net_sales_ex_gst"]
        st_obj["gross_sales"] += s["gross_sales"]
        st_obj["returns"] += s["returns"]
        st_obj["bills"] += s["bills"]
        st_obj["sale_units"] += s["sale_units"]
        st_obj["sale_discount"] += s.get("sale_discount", 0.0)
        st_obj["sale_mrp_value"] += s.get("sale_mrp_value", 0.0)
        st_obj["gross_margin"] += s["gross_margin"]
        st_obj["prev_net_sales"] += s["prev_net_sales"]

        # Merge sparkline days
        for idx, val in enumerate(s.get("sparkline") or []):
            st_obj["daily_sales"][idx] = st_obj["daily_sales"].get(idx, 0.0) + val

    states_list = []
    for st, st_data in states_dict.items():
        st_sales = st_data["net_sales_incl_gst"]
        st_prev = st_data["prev_net_sales"]
        st_count = len(st_data["stores"])

        share_pct = round((st_sales / total_net_sales) * 100.0, 2) if total_net_sales > 0 else 0.0
        sales_per_store = round(st_sales / st_count, 2) if st_count > 0 else 0.0
        change_pct = (
            round(((st_sales - st_prev) / st_prev) * 100.0, 1)
            if st_prev > 0 else 0.0
        )
        # Contribution to total growth = state change as a share of network change
        st_growth_delta = st_sales - st_prev
        growth_contrib = (
            round((st_growth_delta / total_sales_delta) * 100.0, 1)
            if abs(total_sales_delta) > 0 else 0.0
        )

        b = st_data["bills"]
        u = st_data["sale_units"]
        g = st_data["gross_sales"]
        r = st_data["returns"]
        mrp = st_data["sale_mrp_value"]
        disc = st_data["sale_discount"]
        gm = st_data["gross_margin"]
        ex = st_data["net_sales_ex_gst"]

        sparkline = [
            round(st_data["daily_sales"][i], 2)
            for i in sorted(st_data["daily_sales"].keys())
        ]

        states_list.append({
            "state": st,
            "zone": st_data["zone"],
            "stores_count": st_count if st_count > 0 else len(st_data.get("all_network_stores", [])),
            "active_stores_count": st_count,
            "total_network_stores": len(st_data.get("all_network_stores", [])),
            "own_count": st_data["own_count"] if st_count > 0 else st_data.get("total_network_own", 0),
            "franchise_count": st_data["franchise_count"] if st_count > 0 else st_data.get("total_network_franchise", 0),
            "is_franchise_only": st_data.get("total_network_own", 0) == 0 and st_data.get("total_network_franchise", 0) > 0,
            "net_sales_incl_gst": round(st_sales, 2),
            "share_pct": share_pct,
            "sales_per_store": sales_per_store,
            "bills": b,
            "aov": round(g / b, 2) if b > 0 else 0.0,
            "upt": round(u / b, 2) if b > 0 else 0.0,
            "discount_pct": round((disc / mrp) * 100.0, 1) if mrp > 0 else 0.0,
            "gross_margin_pct": round((gm / ex) * 100.0, 1) if ex > 0 else 0.0,
            "return_rate": round((r / g) * 100.0, 1) if g > 0 else 0.0,
            "sparkline": sparkline,
            "prev_net_sales": round(st_prev, 2),
            "change_pct": change_pct,
            "growth_contribution": growth_contrib,
            "stores": st_data["stores"]
        })

    # Sort states by net sales descending
    states_list.sort(key=lambda x: x["net_sales_incl_gst"], reverse=True)

    # 4. Rollup by City
    cities_dict: Dict[str, Dict[str, Any]] = {}
    for s in active_stores:
        ct = s["city"]
        if ct not in cities_dict:
            cities_dict[ct] = {
                "city": ct,
                "state": s["state"],
                "zone": s["zone"],
                "lat": s["lat"],
                "lng": s["lng"],
                "stores": [],
                "own_count": 0,
                "franchise_count": 0,
                "net_sales_incl_gst": 0.0,
                "net_sales_ex_gst": 0.0,
                "gross_sales": 0.0,
                "returns": 0.0,
                "bills": 0,
                "sale_units": 0,
                "sale_discount": 0.0,
                "sale_mrp_value": 0.0,
                "gross_margin": 0.0,
                "prev_net_sales": 0.0,
            }
        ct_obj = cities_dict[ct]
        ct_obj["stores"].append(s)
        if "own" in s["store_type"].lower():
            ct_obj["own_count"] += 1
        else:
            ct_obj["franchise_count"] += 1
        ct_obj["net_sales_incl_gst"] += s["net_sales_incl_gst"]
        ct_obj["net_sales_ex_gst"] += s["net_sales_ex_gst"]
        ct_obj["gross_sales"] += s["gross_sales"]
        ct_obj["returns"] += s["returns"]
        ct_obj["bills"] += s["bills"]
        ct_obj["sale_units"] += s["sale_units"]
        ct_obj["sale_discount"] += s.get("sale_discount", 0.0)
        ct_obj["sale_mrp_value"] += s.get("sale_mrp_value", 0.0)
        ct_obj["gross_margin"] += s["gross_margin"]
        ct_obj["prev_net_sales"] += s["prev_net_sales"]

    cities_list = []
    for ct, ct_data in cities_dict.items():
        ct_sales = ct_data["net_sales_incl_gst"]
        ct_prev = ct_data["prev_net_sales"]
        ct_count = len(ct_data["stores"])
        share_pct = round((ct_sales / total_net_sales) * 100.0, 2) if total_net_sales > 0 else 0.0
        sales_per_store = round(ct_sales / ct_count, 2) if ct_count > 0 else 0.0
        change_pct = (
            round(((ct_sales - ct_prev) / ct_prev) * 100.0, 1)
            if ct_prev > 0 else 0.0
        )

        b = ct_data["bills"]
        u = ct_data["sale_units"]
        g = ct_data["gross_sales"]
        r = ct_data["returns"]
        mrp = ct_data["sale_mrp_value"]
        disc = ct_data["sale_discount"]
        gm = ct_data["gross_margin"]
        ex = ct_data["net_sales_ex_gst"]

        # Sort store children by net sales desc
        ct_data["stores"].sort(key=lambda x: x["net_sales_incl_gst"], reverse=True)

        cities_list.append({
            "city": ct,
            "state": ct_data["state"],
            "zone": ct_data["zone"],
            "lat": ct_data["lat"],
            "lng": ct_data["lng"],
            "stores_count": ct_count,
            "own_count": ct_data["own_count"],
            "franchise_count": ct_data["franchise_count"],
            "net_sales_incl_gst": round(ct_sales, 2),
            "share_pct": share_pct,
            "sales_per_store": sales_per_store,
            "bills": b,
            "aov": round(g / b, 2) if b > 0 else 0.0,
            "upt": round(u / b, 2) if b > 0 else 0.0,
            "discount_pct": round((disc / mrp) * 100.0, 1) if mrp > 0 else 0.0,
            "gross_margin_pct": round((gm / ex) * 100.0, 1) if ex > 0 else 0.0,
            "return_rate": round((r / g) * 100.0, 1) if g > 0 else 0.0,
            "prev_net_sales": round(ct_prev, 2),
            "change_pct": change_pct,
            "stores": ct_data["stores"]
        })

    # Sort cities by net sales descending
    cities_list.sort(key=lambda x: x["net_sales_incl_gst"], reverse=True)

    # 5. Rollup by Zone
    zones_dict: Dict[str, Dict[str, Any]] = {}
    for s in active_stores:
        zn = s["zone"]
        if zn not in zones_dict:
            zones_dict[zn] = {
                "zone": zn,
                "stores_count": 0,
                "own_count": 0,
                "franchise_count": 0,
                "net_sales_incl_gst": 0.0,
                "prev_net_sales": 0.0,
                "states": set()
            }
        z_obj = zones_dict[zn]
        z_obj["stores_count"] += 1
        if "own" in s["store_type"].lower():
            z_obj["own_count"] += 1
        else:
            z_obj["franchise_count"] += 1
        z_obj["net_sales_incl_gst"] += s["net_sales_incl_gst"]
        z_obj["prev_net_sales"] += s["prev_net_sales"]
        z_obj["states"].add(s["state"])

    zones_list = []
    zone_order = ["North", "West", "South", "Central & East"]
    for zn in zone_order:
        z_data = zones_dict.get(zn)
        if not z_data:
            continue
        z_sales = z_data["net_sales_incl_gst"]
        z_prev = z_data["prev_net_sales"]
        z_count = z_data["stores_count"]
        share_pct = round((z_sales / total_net_sales) * 100.0, 2) if total_net_sales > 0 else 0.0
        sales_per_store = round(z_sales / z_count, 2) if z_count > 0 else 0.0
        change_pct = (
            round(((z_sales - z_prev) / z_prev) * 100.0, 1)
            if z_prev > 0 else 0.0
        )
        zones_list.append({
            "zone": zn,
            "net_sales_incl_gst": round(z_sales, 2),
            "share_pct": share_pct,
            "sales_per_store": sales_per_store,
            "stores_count": z_count,
            "own_count": z_data["own_count"],
            "franchise_count": z_data["franchise_count"],
            "states_count": len(z_data["states"]),
            "prev_net_sales": round(z_prev, 2),
            "change_pct": change_pct
        })

    # 6. Multi-Store City Comparison
    # For cities with 2+ stores (Hyderabad, Ahmedabad, Mumbai, Bengaluru, Delhi, Jaipur, Patna, Surat)
    multi_store_cities = []
    for c in cities_list:
        if c["stores_count"] >= 2:
            city_avg = c["sales_per_store"]
            store_variances = []
            for st in c["stores"]:
                variance_pct = (
                    round(((st["net_sales_incl_gst"] - city_avg) / city_avg) * 100.0, 1)
                    if city_avg > 0 else 0.0
                )
                store_variances.append({
                    "store_name": st["store_name"],
                    "display_name": st["display_name"],
                    "store_type": st["store_type"],
                    "is_new": st["is_new"],
                    "net_sales_incl_gst": st["net_sales_incl_gst"],
                    "variance_pct": variance_pct,
                    "city_avg": city_avg
                })
            multi_store_cities.append({
                "city": c["city"],
                "state": c["state"],
                "stores_count": c["stores_count"],
                "city_net_sales": c["net_sales_incl_gst"],
                "city_avg": city_avg,
                "stores": store_variances
            })

    # 7. State x Week Heatmap Transformation
    # Map store sales back to its state
    store_to_state = {s["store_name"]: s["state"] for s in processed_stores}
    heatmap_matrix: Dict[str, Dict[str, float]] = {}
    all_weeks = set()
    for row in rows_heatmap:
        s_name = row["store_name"]
        st = store_to_state.get(s_name) or get_store_geo(s_name).get("state", "Unmapped")
        w_start = str(row["week_start"])
        all_weeks.add(w_start)
        if st not in heatmap_matrix:
            heatmap_matrix[st] = {}
        heatmap_matrix[st][w_start] = heatmap_matrix[st].get(w_start, 0.0) + float(row["week_net_sales"] or 0.0)

    sorted_weeks = sorted(list(all_weeks))
    week_metadata = []
    for idx, w in enumerate(sorted_weeks):
        try:
            w_dt = datetime.strptime(w, "%Y-%m-%d").date()
            w_end_dt = min(w_dt + timedelta(days=6), e_dt)
            date_range_str = f"{w_dt.day}–{w_end_dt.day} {w_end_dt.strftime('%b')}" if w_dt.month == w_end_dt.month else f"{w_dt.strftime('%d %b')}–{w_end_dt.strftime('%d %b')}"
        except Exception:
            date_range_str = w
        week_metadata.append({
            "week_key": w,
            "week_index": idx + 1,
            "label": f"W{idx + 1}",
            "date_range": date_range_str,
            "is_current": (idx == len(sorted_weeks) - 1)
        })

    heatmap_rows = []
    for st_obj in states_list:
        st = st_obj["state"]
        week_vals = {w: round(heatmap_matrix.get(st, {}).get(w, 0.0), 2) for w in sorted_weeks}
        heat_total = round(sum(week_vals.values()), 2)
        heat_avg = round(heat_total / len(sorted_weeks), 2) if sorted_weeks else 0.0
        heatmap_rows.append({
            "state": st,
            "zone": st_obj["zone"],
            "total_sales": heat_total,
            "avg_weekly_sales": heat_avg,
            "weeks": week_vals
        })
    heatmap_rows.sort(key=lambda x: x["total_sales"], reverse=True)

    # 8. Rule-Based Computed Insights
    insights = []

    # Rule 1: Top-3 states share
    if len(states_list) >= 3:
        top_3_sales = sum(s["net_sales_incl_gst"] for s in states_list[:3])
        top_3_share = round((top_3_sales / total_net_sales) * 100.0, 1) if total_net_sales > 0 else 0.0
        top_3_names = ", ".join(s["state"] for s in states_list[:3])
        insights.append({
            "id": "top_3_share",
            "type": "concentration",
            "title": f"Top 3 States Drive {top_3_share}% of Network Revenue",
            "description": f"{top_3_names} account for ₹{top_3_sales:,.0f} ({top_3_share}%) of total retail net sales.",
            "severity": "info"
        })

    # Rule 2: State with highest sales per store
    if states_list:
        highest_sps = max(states_list, key=lambda x: x["sales_per_store"])
        insights.append({
            "id": "highest_sps",
            "type": "productivity",
            "title": f"{highest_sps['state']} Leads Store Productivity",
            "description": f"{highest_sps['state']} generates ₹{highest_sps['sales_per_store']:,.0f} per store across {highest_sps['stores_count']} stores ({round(highest_sps['sales_per_store']/network_sales_per_store, 1) if network_sales_per_store > 0 else 1}x network average).",
            "severity": "success"
        })

    # Rule 3: States with discount > 3 pp above network
    high_disc_states = [
        s for s in states_list
        if s["discount_pct"] > (network_discount_pct + 3.0) and s["net_sales_incl_gst"] > 50000
    ]
    if high_disc_states:
        disc_names = ", ".join(f"{s['state']} ({s['discount_pct']}%)" for s in high_disc_states)
        insights.append({
            "id": "high_discount_states",
            "type": "discount",
            "title": f"High Discounting in {len(high_disc_states)} State{'s' if len(high_disc_states) > 1 else ''}",
            "description": f"Discount rate in {disc_names} exceeds network baseline of {network_discount_pct}% by over 3 percentage points.",
            "severity": "warning"
        })

    # Rule 4: States whose sales fell > 15% vs previous period (min volume threshold ₹50k)
    drop_states = [
        s for s in states_list
        if s["change_pct"] < -15.0 and s["prev_net_sales"] >= 50000
    ]
    if drop_states:
        drop_names = ", ".join(f"{s['state']} ({s['change_pct']}%)" for s in drop_states)
        insights.append({
            "id": "sales_drop_states",
            "type": "drop",
            "title": f"Sales Drop Alert: {len(drop_states)} State{'s' if len(drop_states) > 1 else ''} Down >15%",
            "description": f"{drop_names} experienced double-digit contraction compared to the previous period.",
            "severity": "danger"
        })

    # Rule 5: City with widest spread between best and worst store
    if multi_store_cities:
        city_spreads = []
        for mc in multi_store_cities:
            if len(mc["stores"]) >= 2:
                sales_vals = [st["net_sales_incl_gst"] for st in mc["stores"]]
                spread = max(sales_vals) - min(sales_vals)
                best_store = max(mc["stores"], key=lambda x: x["net_sales_incl_gst"])
                worst_store = min(mc["stores"], key=lambda x: x["net_sales_incl_gst"])
                city_spreads.append({
                    "city": mc["city"],
                    "spread": spread,
                    "best": best_store,
                    "worst": worst_store,
                    "ratio": round(best_store["net_sales_incl_gst"] / max(worst_store["net_sales_incl_gst"], 1), 1)
                })
        if city_spreads:
            widest = max(city_spreads, key=lambda x: x["spread"])
            insights.append({
                "id": "city_store_spread",
                "type": "disparity",
                "title": f"Widest Store Disparity in {widest['city']}",
                "description": f"In {widest['city']}, top store ({widest['best']['display_name']}: ₹{widest['best']['net_sales_incl_gst']:,.0f}) outsells lowest store ({widest['worst']['display_name']}: ₹{widest['worst']['net_sales_incl_gst']:,.0f}) by {widest['ratio']}x (spread: ₹{widest['spread']:,.0f}).",
                "severity": "warning"
            })

    top_state = states_list[0] if states_list else None
    new_stores_count = sum(1 for s in processed_stores if s["is_new"])

    # Process Top 50 unique products
    top_products = []
    for idx, r in enumerate(rows_products):
        derived = compute_derived_metrics(r)
        share_pct = (
            round((derived["net_sales_incl_gst"] / total_net_sales) * 100.0, 2)
            if total_net_sales > 0 else 0.0
        )
        top_products.append({
            "rank": idx + 1,
            "product_name": r["product_name"],
            "skus_count": r.get("skus_count") or 1,
            "colors_count": r.get("colors_count") or 1,
            "gender": r.get("gender") or "Unisex",
            "stores_selling": r.get("stores_selling") or 0,
            "share_pct": share_pct,
            **derived
        })

    result = {
        "summary": {
            "states_covered": len(states_list),
            "cities_covered": len(cities_list),
            "total_stores": len(processed_stores),
            "active_stores_count": len(active_stores),
            "mature_stores_count": len(processed_stores) - new_stores_count,
            "new_stores_count": new_stores_count,
            "net_sales": round(total_net_sales, 2),
            "prev_net_sales": round(total_prev_sales, 2),
            "sales_delta_pct": network_sales_delta_pct,
            "sales_per_store": network_sales_per_store,
            "top_state_name": top_state["state"] if top_state else "None",
            "top_state_share": top_state["share_pct"] if top_state else 0.0,
            "bills": total_bills,
            "sale_units": total_units,
            "aov": network_aov,
            "upt": network_upt,
            "discount_pct": network_discount_pct,
            "gross_margin_pct": network_margin_pct,
            "return_rate": network_return_rate
        },
        "states": states_list,
        "cities": cities_list,
        "zones": zones_list,
        "stores": processed_stores,
        "multi_store_cities": multi_store_cities,
        "state_week_heatmap": {
            "weeks": sorted_weeks,
            "week_metadata": week_metadata,
            "rows": heatmap_rows
        },
        "top_products": top_products,
        "insights": insights,
        "unmapped_stores": unmapped_stores,
        "date_bounds": {
            "start": s_date,
            "end": e_date,
            "prev_start": prev_s_date,
            "prev_end": prev_e_date
        }
    }

    cache.set("geography:summary_v2", cache_params, result)
    return result


SOCK_PRODUCTS = {
    'Ankle HT1', 'Crew HT1', 'Noshow HT1',
    'Noshow HT1 LTD', 'Noshow NT1', 'Qtr HT1'
}


@router.get("/products")
def get_geography_top_products(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    level: str = Query("state"),
    selected_geo: str = Query("all"),
    rank_by: str = Query("net_sales"),
    top_n: int = Query(50),
    category_mode: str = Query("footwear"),
):
    """
    Top 50 products by geography section.
    Supports filtering by level (Zone, State, City, Store), rank by (Net sales, Units),
    Footwear only vs All items, index vs network calculation, and Top 50 products x 16 states heatmap.
    """
    s_date = start_date if (isinstance(start_date, str) and start_date) else DATA_MIN_DATE
    e_date = end_date if (isinstance(end_date, str) and end_date) else DATA_MAX_DATE
    st_val = store_type if isinstance(store_type, str) else DEFAULT_STORE_TYPE
    reg_list = regions if isinstance(regions, list) else None
    sto_list = stores if isinstance(stores, list) else None
    gen_list = genders if isinstance(genders, list) else None
    dep_list = departments if isinstance(departments, list) else None
    prd_val = product if isinstance(product, str) else None

    if s_date < DATA_MIN_DATE:
        s_date = DATA_MIN_DATE

    lvl = level.lower().strip() if (isinstance(level, str) and level) else "state"
    geo_sel = selected_geo.strip() if (isinstance(selected_geo, str) and selected_geo) else "all"
    rank_by_str = rank_by.lower().strip() if (isinstance(rank_by, str) and rank_by) else "net_sales"
    rank_col = "sale_units" if rank_by_str == "units" else "net_sales_incl_gst"
    cat_mode = category_mode.lower().strip() if (isinstance(category_mode, str) and category_mode) else "footwear"
    try:
        top_n_val = int(top_n) if not hasattr(top_n, "default") else 50
    except Exception:
        top_n_val = 50

    cache_params = {
        "s": s_date, "e": e_date, "st": st_val or "",
        "reg": ",".join(sorted(reg_list)) if reg_list else "",
        "sto": ",".join(sorted(sto_list)) if sto_list else "",
        "gen": ",".join(sorted(gen_list)) if gen_list else "",
        "dep": ",".join(sorted(dep_list)) if dep_list else "",
        "p": prd_val or "",
        "lvl": lvl,
        "geo": geo_sel,
        "rank": rank_by_str,
        "n": str(top_n_val),
        "cat": cat_mode
    }
    cached = cache.get("geography:top_products_v3", cache_params)
    if cached:
        return cached

    geo_config = load_store_geo()

    # 1. Query store_name x product_name (cached raw data if available)
    raw_cache_params = {
        "s": s_date, "e": e_date, "st": st_val or "",
        "reg": ",".join(sorted(reg_list)) if reg_list else "",
        "sto": ",".join(sorted(sto_list)) if sto_list else "",
        "gen": ",".join(sorted(gen_list)) if gen_list else "",
        "dep": ",".join(sorted(dep_list)) if dep_list else "",
        "p": prd_val or "",
    }
    raw_rows = cache.get("geography:raw_store_product", raw_cache_params)
    if not raw_rows:
        where_curr, params_curr = build_filter_clause(
            start_date=s_date,
            end_date=e_date,
            store_type=st_val,
            regions=reg_list,
            stores=sto_list,
            genders=gen_list,
            departments=dep_list,
            product_search=prd_val,
            prefix="curr"
        )
        sql = f"""
        SELECT
            store_name,
            product_name,
            MAX(gender) AS gender,
            SUM(units) AS sale_units,
            SUM(sales_ex_gst) AS net_sales_ex_gst,
            SUM(amount_incl_gst) AS net_sales_incl_gst,
            SUM(mrp_value) AS sale_mrp_value,
            SUM(discount) AS sale_discount,
            SUM(cost) AS total_cost,
            SUM(gross_margin) AS gross_margin,
            COUNT(DISTINCT bill_key) AS bills
        FROM `{VIEW_NAME}`
        WHERE {where_curr}
        GROUP BY store_name, product_name
        """
        raw_rows = execute_query(sql, params_curr)
        cache.set("geography:raw_store_product", raw_cache_params, raw_rows)

    # Filter rows based on category_mode
    if cat_mode == "footwear":
        active_rows = [dict(r) for r in raw_rows if r["product_name"] not in SOCK_PRODUCTS]
    else:
        active_rows = [dict(r) for r in raw_rows]

    # Attach geo information
    for r in active_rows:
        s_info = geo_config.get(r["store_name"], {})
        r["zone"] = s_info.get("zone", "Unmapped")
        r["state"] = s_info.get("state", "Unmapped")
        r["city"] = s_info.get("city", "Unmapped")
        r["display_name"] = s_info.get("display_name", r["store_name"])
        r["store_type"] = s_info.get("store_type", "Own store")

    # Compute network-level product baseline
    network_total_sales = sum(float(r["net_sales_incl_gst"] or 0.0) for r in active_rows)
    network_total_units = sum(int(r["sale_units"] or 0) for r in active_rows)
    network_stores_set = set(r["store_name"] for r in active_rows)
    network_store_count = len(network_stores_set)

    network_product_sales: Dict[str, float] = {}
    network_product_units: Dict[str, int] = {}
    for r in active_rows:
        p = r["product_name"]
        network_product_sales[p] = network_product_sales.get(p, 0.0) + float(r["net_sales_incl_gst"] or 0.0)
        network_product_units[p] = network_product_units.get(p, 0) + int(r["sale_units"] or 0)

    network_shares = {
        p: (sales / network_total_sales) * 100.0
        for p, sales in network_product_sales.items()
    } if network_total_sales > 0 else {}

    # Build picker options for all levels (Initialize all 16 states & 4 zones from config)
    zones_map: Dict[str, Dict[str, Any]] = {}
    states_map: Dict[str, Dict[str, Any]] = {}
    cities_map: Dict[str, Dict[str, Any]] = {}
    stores_map: Dict[str, Dict[str, Any]] = {}

    for sn, sinfo in geo_config.items():
        st = sinfo.get("state")
        z = sinfo.get("zone", "Unmapped")
        c = sinfo.get("city", "Unmapped")
        if z and z not in zones_map:
            zones_map[z] = {"name": z, "stores": set(), "all_network_stores": set(), "net_sales": 0.0}
        if z:
            zones_map[z]["all_network_stores"].add(sn)

        if st and st not in states_map:
            states_map[st] = {"name": st, "zone": z, "stores": set(), "all_network_stores": set(), "net_sales": 0.0}
        if st:
            states_map[st]["all_network_stores"].add(sn)

        if c and c not in cities_map:
            cities_map[c] = {"name": c, "state": st, "stores": set(), "all_network_stores": set(), "net_sales": 0.0}
        if c:
            cities_map[c]["all_network_stores"].add(sn)

        if sn not in stores_map:
            stores_map[sn] = {
                "name": sn,
                "display_name": sinfo.get("display_name", sn),
                "city": c,
                "state": st,
                "store_type": sinfo.get("store_type", "Own store"),
                "net_sales": 0.0
            }

    for r in active_rows:
        z = r["zone"]
        st = r["state"]
        c = r["city"]
        sn = r["store_name"]
        sl = float(r["net_sales_incl_gst"] or 0.0)

        if z in zones_map:
            zones_map[z]["stores"].add(sn)
            zones_map[z]["net_sales"] += sl

        if st in states_map:
            states_map[st]["stores"].add(sn)
            states_map[st]["net_sales"] += sl

        if c in cities_map:
            cities_map[c]["stores"].add(sn)
            cities_map[c]["net_sales"] += sl

        if sn in stores_map:
            stores_map[sn]["net_sales"] += sl

    picker_options = {
        "zones": [
            {"id": "all", "name": "All India (All Zones)", "stores_count": network_store_count, "net_sales": round(network_total_sales, 2)}
        ] + [
            {"id": z, "name": z, "stores_count": len(d["stores"]) if len(d["stores"]) > 0 else len(d["all_network_stores"]), "net_sales": round(d["net_sales"], 2)}
            for z, d in sorted(zones_map.items(), key=lambda x: (x[1]["net_sales"], len(x[1]["stores"])), reverse=True)
        ],
        "states": [
            {"id": "all", "name": "All India (All States)", "stores_count": network_store_count, "net_sales": round(network_total_sales, 2)}
        ] + [
            {
                "id": st,
                "name": f"{st} ({len(d['stores'])} stores)" if len(d["stores"]) > 0 else f"{st} (0 own, {len(d['all_network_stores'])} fran)",
                "zone": d["zone"],
                "stores_count": len(d["stores"]) if len(d["stores"]) > 0 else len(d["all_network_stores"]),
                "active_stores_count": len(d["stores"]),
                "net_sales": round(d["net_sales"], 2)
            }
            for st, d in sorted(states_map.items(), key=lambda x: (x[1]["net_sales"], len(x[1]["stores"])), reverse=True)
        ],
        "cities": [
            {"id": "all", "name": "All India (All Cities)", "stores_count": network_store_count, "net_sales": round(network_total_sales, 2)}
        ] + [
            {"id": c, "name": f"{c} ({d['state']})", "city": c, "state": d["state"], "stores_count": len(d["stores"]) if len(d["stores"]) > 0 else len(d["all_network_stores"]), "net_sales": round(d["net_sales"], 2)}
            for c, d in sorted(cities_map.items(), key=lambda x: (x[1]["net_sales"], len(x[1]["stores"])), reverse=True)
        ],
        "stores": [
            {"id": "all", "name": "All India (All Stores)", "stores_count": network_store_count, "net_sales": round(network_total_sales, 2)}
        ] + [
            {"id": sn, "name": d["display_name"], "store_name": sn, "city": d["city"], "state": d["state"], "store_type": d["store_type"], "net_sales": round(d["net_sales"], 2)}
            for sn, d in sorted(stores_map.items(), key=lambda x: x[1]["net_sales"], reverse=True)
        ]
    }

    # Filter rows by selected geography
    is_all_india = geo_sel.lower() in ["all", "all india", "all states", "all cities", "all zones", "all stores", ""]
    if is_all_india:
        geo_rows = active_rows
        total_geo_stores = network_store_count
        geo_label = "All India"
    else:
        if lvl == "zone":
            geo_rows = [r for r in active_rows if r["zone"].lower() == geo_sel.lower()]
            total_geo_stores = len(zones_map.get(geo_sel, {}).get("stores", []))
            geo_label = f"{geo_sel} Zone"
        elif lvl == "city":
            geo_rows = [r for r in active_rows if r["city"].lower() == geo_sel.lower()]
            total_geo_stores = len(cities_map.get(geo_sel, {}).get("stores", []))
            geo_label = geo_sel
        elif lvl == "store":
            geo_rows = [
                r for r in active_rows
                if r["store_name"].lower() == geo_sel.lower() or r["display_name"].lower() == geo_sel.lower()
            ]
            total_geo_stores = 1
            geo_label = stores_map.get(geo_sel, {}).get("display_name", geo_sel)
        else:  # default state
            geo_rows = [r for r in active_rows if r["state"].lower() == geo_sel.lower()]
            total_geo_stores = len(states_map.get(geo_sel, {}).get("stores", []))
            geo_label = geo_sel

        if total_geo_stores == 0:
            total_geo_stores = len(set(r["store_name"] for r in geo_rows))

    geo_total_sales = sum(float(r["net_sales_incl_gst"] or 0.0) for r in geo_rows)
    geo_total_units = sum(int(r["sale_units"] or 0) for r in geo_rows)

    # Rollup by product in selected geography
    geo_products_map: Dict[str, Dict[str, Any]] = {}
    for r in geo_rows:
        p = r["product_name"]
        if p not in geo_products_map:
            geo_products_map[p] = {
                "product_name": p,
                "gender": r.get("gender") or "Unisex",
                "sale_units": 0,
                "net_sales_incl_gst": 0.0,
                "net_sales_ex_gst": 0.0,
                "sale_mrp_value": 0.0,
                "sale_discount": 0.0,
                "gross_margin": 0.0,
                "bills": 0,
                "stores": set()
            }
        obj = geo_products_map[p]
        obj["sale_units"] += int(r["sale_units"] or 0)
        obj["net_sales_incl_gst"] += float(r["net_sales_incl_gst"] or 0.0)
        obj["net_sales_ex_gst"] += float(r["net_sales_ex_gst"] or 0.0)
        obj["sale_mrp_value"] += float(r["sale_mrp_value"] or 0.0)
        obj["sale_discount"] += float(r["sale_discount"] or 0.0)
        obj["gross_margin"] += float(r["gross_margin"] or 0.0)
        obj["bills"] += int(r["bills"] or 0)
        obj["stores"].add(r["store_name"])

    product_list = []
    for p, obj in geo_products_map.items():
        units = obj["sale_units"]
        net_sales = obj["net_sales_incl_gst"]
        share_pct = round((net_sales / geo_total_sales) * 100.0, 2) if geo_total_sales > 0 else 0.0

        if is_all_india:
            index_val = 100.0
        else:
            if units < 20:
                index_val = None
            else:
                p_net_share = network_shares.get(p, 0.0)
                index_val = round((share_pct / p_net_share) * 100.0, 1) if p_net_share > 0 else None

        mrp = obj["sale_mrp_value"]
        disc = obj["sale_discount"]
        discount_pct = round((disc / mrp) * 100.0, 1) if mrp > 0 else 0.0

        ex_gst = obj["net_sales_ex_gst"]
        margin = obj["gross_margin"]
        gross_margin_pct = round((margin / ex_gst) * 100.0, 1) if ex_gst > 0 else 0.0
        stores_selling = len(obj["stores"])

        product_list.append({
            "product_name": p,
            "gender": obj["gender"],
            "sale_units": units,
            "net_sales_incl_gst": round(net_sales, 2),
            "share_pct": share_pct,
            "index_vs_network": index_val,
            "discount_pct": discount_pct,
            "gross_margin_pct": gross_margin_pct,
            "stores_selling": stores_selling,
            "total_geo_stores": total_geo_stores,
            "asp": round(net_sales / units, 1) if units > 0 else 0.0,
            "bills": obj["bills"]
        })

    # Sort and rank
    product_list.sort(key=lambda x: x[rank_col], reverse=True)
    for idx, item in enumerate(product_list):
        item["rank"] = idx + 1

    top_products = product_list[:top_n_val]
    top_n_sales = sum(p["net_sales_incl_gst"] for p in top_products)
    top_n_share_pct = round((top_n_sales / geo_total_sales) * 100.0, 1) if geo_total_sales > 0 else 0.0

    # Low volume warning: under 3 stores or under 200 units
    low_volume_warning = (total_geo_stores < 3) or (geo_total_units < 200)

    # 5. Build Top 50 Network Products x 16 States Heatmap
    top_50_network_products = sorted(
        network_product_sales.keys(),
        key=lambda k: network_product_sales[k] if rank_by_str == "net_sales" else network_product_units.get(k, 0),
        reverse=True
    )[:50]

    all_16_states = [
        "Andhra Pradesh", "Bihar", "Chhattisgarh", "Delhi", "Goa",
        "Gujarat", "Haryana", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Punjab", "Rajasthan", "Telangana", "Uttar Pradesh", "Uttarakhand"
    ]

    state_sales_totals: Dict[str, float] = {}
    for r in active_rows:
        st = r["state"]
        state_sales_totals[st] = state_sales_totals.get(st, 0.0) + float(r["net_sales_incl_gst"] or 0.0)

    state_prod_matrix: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for r in active_rows:
        p = r["product_name"]
        if p not in top_50_network_products:
            continue
        st = r["state"]
        if p not in state_prod_matrix:
            state_prod_matrix[p] = {}
        if st not in state_prod_matrix[p]:
            state_prod_matrix[p][st] = {"units": 0, "net_sales": 0.0}
        state_prod_matrix[p][st]["units"] += int(r["sale_units"] or 0)
        state_prod_matrix[p][st]["net_sales"] += float(r["net_sales_incl_gst"] or 0.0)

    heatmap_cells: Dict[str, Dict[str, Any]] = {}
    for p in top_50_network_products:
        p_net_share = network_shares.get(p, 0.0)
        heatmap_cells[p] = {}
        for st in all_16_states:
            cell = state_prod_matrix.get(p, {}).get(st, {"units": 0, "net_sales": 0.0})
            st_sales = state_sales_totals.get(st, 0.0)
            st_share = round((cell["net_sales"] / st_sales) * 100.0, 2) if st_sales > 0 else 0.0
            idx_val = round((st_share / p_net_share) * 100.0, 1) if (cell["units"] >= 20 and p_net_share > 0) else None

            st_active_cnt = len(states_map.get(st, {}).get("stores", []))
            st_all_cnt = len(states_map.get(st, {}).get("all_network_stores", []))
            st_fran_cnt = sum(1 for s in geo_config.values() if s.get("state") == st and "franchise" in s.get("store_type", "").lower())
            is_fran_only = (st_active_cnt == 0 and st_fran_cnt > 0)

            heatmap_cells[p][st] = {
                "units": cell["units"],
                "net_sales": round(cell["net_sales"], 2),
                "share_pct": st_share,
                "index": idx_val,
                "active_stores": st_active_cnt,
                "is_franchise_only": is_fran_only,
                "franchise_count": st_fran_cnt,
                "total_stores": st_all_cnt
            }

    heatmap_state_meta = {}
    for st in all_16_states:
        st_active_cnt = len(states_map.get(st, {}).get("stores", []))
        st_all_cnt = len(states_map.get(st, {}).get("all_network_stores", []))
        st_fran_cnt = sum(1 for s in geo_config.values() if s.get("state") == st and "franchise" in s.get("store_type", "").lower())
        heatmap_state_meta[st] = {
            "active_stores": st_active_cnt,
            "total_stores": st_all_cnt,
            "franchise_stores": st_fran_cnt,
            "is_franchise_only": (st_active_cnt == 0 and st_fran_cnt > 0),
            "net_sales": round(state_sales_totals.get(st, 0.0), 2)
        }

    result = {
        "level": lvl,
        "selected_geo": geo_sel,
        "geo_label": geo_label,
        "rank_by": rank_by_str,
        "top_n": top_n_val,
        "category_mode": cat_mode,
        "footwear_rule": "Footwear only excludes 6 sock lines: Ankle HT1, Crew HT1, Noshow HT1, Noshow HT1 LTD, Noshow NT1, Qtr HT1",
        "summary": {
            "total_geo_sales": round(geo_total_sales, 2),
            "total_geo_units": geo_total_units,
            "total_geo_stores": total_geo_stores,
            "top_n_sales": round(top_n_sales, 2),
            "top_n_share_pct": top_n_share_pct,
            "low_volume_warning": low_volume_warning,
            "network_total_sales": round(network_total_sales, 2),
            "network_total_units": network_total_units,
        },
        "picker_options": picker_options,
        "products": top_products,
        "heatmap": {
            "products": top_50_network_products,
            "states": all_16_states,
            "state_meta": heatmap_state_meta,
            "matrix": heatmap_cells
        }
    }

    cache.set("geography:top_products_v3", cache_params, result)
    return result
