"""
Overview router for Kadam dashboard.
Provides KPIs with previous period deltas, daily trends, day-of-week and hourly distributions,
store split, top/bottom stores with sparklines, hero period snapshot, waterfalls, pareto, and rule-based insights.
"""
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException

logger = logging.getLogger(__name__)

from backend.db import execute_query, build_filter_clause
from backend.metrics import get_sql_metric_aggregates, compute_derived_metrics, METRIC_REGISTRY
from backend.cache import cache
from backend.geo import load_store_geo, is_new_store
from backend.config import (
    VIEW_NAME,
    DEFAULT_STORE_TYPE,
    DATA_MIN_DATE,
    DATA_MAX_DATE,
    INSIGHT_THRESHOLDS,
)

router = APIRouter(prefix="/api/overview", tags=["overview"])

@router.get("")
def get_overview(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
    compare: Optional[bool] = Query(True),
):
    # Default date range to last 7 days of available data if not passed
    e_date = end_date or DATA_MAX_DATE
    if start_date:
        s_date = start_date
    else:
        try:
            e_dt_calc = datetime.fromisoformat(e_date).date()
            s_date = (e_dt_calc - timedelta(days=6)).isoformat()
        except Exception:
            s_date = "2026-11-10"

    if s_date < DATA_MIN_DATE:
        s_date = DATA_MIN_DATE
    if e_date < s_date:
        e_date = s_date

    cache_params = {
        "s": s_date, "e": e_date, "st": store_type,
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or "", "cmp": compare
    }
    cached = cache.get("overview", cache_params)
    if cached:
        return cached

    # 1. Current period filter clause
    where_curr, params_curr = build_filter_clause(
        start_date=s_date,
        end_date=e_date,
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
        prefix="curr"
    )

    # Calculate previous period bounds (same length)
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
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
        prefix="prev"
    )

    # Filter clause for hero strip snapshot (from DATA_MIN_DATE up to current period end date)
    where_hero, params_hero = build_filter_clause(
        start_date=DATA_MIN_DATE,
        end_date=e_date,
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
        prefix="hero"
    )

    metric_aggs = get_sql_metric_aggregates()

    # Query 1: KPIs (Current + Previous)
    kpi_sql = f"""
    WITH curr AS (
        SELECT 'curr' AS period, {metric_aggs}
        FROM `{VIEW_NAME}`
        WHERE {where_curr}
    ),
    prev AS (
        SELECT 'prev' AS period, {metric_aggs}
        FROM `{VIEW_NAME}`
        WHERE {where_prev}
    )
    SELECT * FROM curr UNION ALL SELECT * FROM prev
    """
    kpi_rows = execute_query(kpi_sql, params_curr + params_prev)
    curr_raw = next((r for r in kpi_rows if r["period"] == "curr"), {})
    prev_raw = next((r for r in kpi_rows if r["period"] == "prev"), {})

    kpi_curr = compute_derived_metrics(curr_raw)
    kpi_prev = compute_derived_metrics(prev_raw) if prev_raw else None

    # Query 2: Daily trend (Current period + Prior period daily align)
    agg_sql = f"""
    WITH base AS (
        SELECT
            bill_date,
            bill_hour,
            store_name,
            store_type,
            product_name,
            product_code,
            amount_incl_gst,
            sales_ex_gst,
            units,
            discount,
            mrp_value,
            cost,
            gross_margin,
            txn_type,
            bill_key
        FROM `{VIEW_NAME}`
        WHERE {where_curr}
    )
    SELECT
        bill_date,
        FORMAT_DATE('%a', bill_date) AS day_short,
        FORMAT_DATE('%A', bill_date) AS day_full,
        EXTRACT(DAYOFWEEK FROM bill_date) IN (1, 7) AS is_weekend,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales_incl_gst,
        COALESCE(SUM(sales_ex_gst), 0) AS net_sales_ex_gst,
        COALESCE(SUM(units), 0) AS net_units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills,
        COALESCE(SUM(gross_margin), 0) AS gross_margin,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN discount ELSE 0 END), 0) AS sale_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN mrp_value ELSE 0 END), 0) AS sale_mrp_value
    FROM base
    GROUP BY bill_date, day_short, day_full, is_weekend
    ORDER BY bill_date
    """
    daily_rows = execute_query(agg_sql, params_curr)
    for d in daily_rows:
        d["aov"] = round(d["net_sales_incl_gst"] / d["bills"], 2) if d["bills"] > 0 else 0
        d["margin_pct"] = round((d["gross_margin"] / d["net_sales_ex_gst"]) * 100.0, 1) if d["net_sales_ex_gst"] > 0 else 0
        d["discount_pct"] = round((d["sale_discount"] / d["sale_mrp_value"]) * 100.0, 1) if d["sale_mrp_value"] > 0 else 0

    # Query 3: Hourly heatmap (bill_hour x weekday)
    hourly_sql = f"""
    SELECT
        bill_hour,
        FORMAT_DATE('%a', bill_date) AS weekday,
        EXTRACT(DAYOFWEEK FROM bill_date) AS day_num,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY bill_hour, weekday, day_num
    ORDER BY day_num, bill_hour
    """
    hourly_rows = execute_query(hourly_sql, params_curr)

    # Query 4: Store type split (Own vs Franchise)
    split_sql = f"""
    SELECT
        store_type,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COALESCE(SUM(sales_ex_gst), 0) AS sales_ex_gst,
        COALESCE(SUM(units), 0) AS net_units,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY store_type
    ORDER BY net_sales DESC
    """
    split_rows = execute_query(split_sql, params_curr)
    total_sales = sum(r["net_sales"] for r in split_rows) or 1
    for r in split_rows:
        r["share_pct"] = round((r["net_sales"] / total_sales) * 100.0, 1)

    # Query 5: Stores performance (for top 5 / bottom 5 with sparklines & Pareto 80/20)
    store_perf_sql = f"""
    SELECT
        store_name,
        store_type,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales,
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills,
        ARRAY_AGG(
            STRUCT(bill_date, amount_incl_gst)
        ) AS raw_sales
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY store_name, store_type
    ORDER BY net_sales DESC
    """
    store_perf_rows = execute_query(store_perf_sql, params_curr)

    # 1. Load store geo config for universe & metadata
    geo_config = load_store_geo()

    # Determine filtered store universe from store_geo.json
    st_norm = "Own store" if store_type in ["Own", "Own stores", "Own store"] else store_type
    if st_norm in ["Own store", "Franchise"]:
        universe_keys = [k for k, v in geo_config.items() if v.get("store_type") == st_norm]
    else:
        universe_keys = list(geo_config.keys())

    if regions:
        clean_reg = set(r.strip() for r in regions if r and r.strip())
        universe_keys = [k for k in universe_keys if geo_config.get(k, {}).get("state") in clean_reg]
    if stores:
        clean_sto = set(s.strip() for s in stores if s and s.strip())
        universe_keys = [k for k in universe_keys if k in clean_sto]

    # Rank only stores with at least one bill in the selected range
    trading_rows = [s for s in store_perf_rows if s.get("bills", 0) >= 1]
    total_store_sales = sum(s["net_sales"] for s in trading_rows) or 1
    total_trading_stores = len(trading_rows)
    trading_names = set(s["store_name"] for s in trading_rows)

    sorted_stores = []
    for idx, s in enumerate(trading_rows):
        daily_dict = {}
        for entry in s.get("raw_sales") or []:
            b_date = str(entry["bill_date"])
            daily_dict[b_date] = daily_dict.get(b_date, 0.0) + (entry["amount_incl_gst"] or 0.0)
        
        sorted_dates = sorted(daily_dict.keys())
        sparkline = [round(daily_dict[d], 2) for d in sorted_dates]

        g_info = geo_config.get(s["store_name"], {})
        f_date = g_info.get("first_bill_date", "2026-10-13")
        is_new = is_new_store(f_date)

        sorted_stores.append({
            "rank": idx + 1,
            "total_ranked": total_trading_stores,
            "store_name": s["store_name"],
            "display_name": g_info.get("display_name", s["store_name"]),
            "store_type": s["store_type"],
            "net_sales": round(s["net_sales"], 2),
            "bills": s["bills"],
            "share_pct": round((s["net_sales"] / total_store_sales) * 100.0, 1),
            "sparkline": sparkline,
            "is_new": is_new,
            "first_bill_date": f_date
        })

    # Stores in the filtered universe with no sales recorded in this period
    no_sales_stores = [
        {
            "store_name": k,
            "display_name": geo_config.get(k, {}).get("display_name", k),
            "store_type": geo_config.get(k, {}).get("store_type", "Unknown")
        }
        for k in universe_keys if k not in trading_names
    ]

    top_5 = sorted_stores[:5]

    # Lowest 5 stores (Attention Needed) rules:
    # 1. Eligible stores: bills >= 5 and NOT is_new
    # 2. Too few bills: bills < 5
    # 3. New stores: is_new
    eligible_lowest = [s for s in sorted_stores if s["bills"] >= 5 and not s["is_new"]]
    bottom_5 = sorted(eligible_lowest, key=lambda x: x["net_sales"])[:5]

    too_few_bills = [s for s in sorted_stores if s["bills"] < 5]
    new_stores_excluded = [s for s in sorted_stores if s["is_new"]]

    # Pareto 80/20 computation
    cum_sales = 0.0
    pareto_stores = []
    stores_for_80_pct = 0
    for idx, s in enumerate(sorted_stores):
        cum_sales += s["net_sales"]
        cum_pct = round((cum_sales / total_store_sales) * 100.0, 1)
        if cum_pct <= 80.0 or (stores_for_80_pct == 0 and cum_pct > 80.0):
            stores_for_80_pct = idx + 1
        pareto_stores.append({
            "rank": idx + 1,
            "store_name": s["store_name"],
            "store_type": s["store_type"],
            "net_sales": s["net_sales"],
            "share_pct": s["share_pct"],
            "cum_share_pct": cum_pct
        })

    # Query 6: Day of week averages
    dow_sql = f"""
    WITH daily_store_sales AS (
        SELECT
            bill_date,
            FORMAT_DATE('%A', bill_date) AS day_name,
            FORMAT_DATE('%a', bill_date) AS day_short,
            EXTRACT(DAYOFWEEK FROM bill_date) AS day_num,
            COALESCE(SUM(amount_incl_gst), 0) AS net_sales
        FROM `{VIEW_NAME}`
        WHERE {where_curr}
        GROUP BY bill_date, day_name, day_short, day_num
    )
    SELECT
        day_name,
        day_short,
        day_num,
        AVG(net_sales) AS avg_sales,
        COUNT(bill_date) AS days_count
    FROM daily_store_sales
    GROUP BY day_name, day_short, day_num
    ORDER BY day_num
    """
    dow_rows = execute_query(dow_sql, params_curr)
    dow_list = [
        {
            "day_name": r["day_name"],
            "day_short": r["day_short"],
            "avg_sales": round(float(r["avg_sales"] or 0), 2),
            "days_count": r["days_count"],
        }
        for r in dow_rows
    ]

    # Query 7: Hero Strip Periods Snapshot (Yesterday, Last 7D, MTD, All Data)
    try:
        t1_dt = datetime.fromisoformat(e_date).date()
    except Exception:
        t1_dt = date(2026, 11, 16)

    yest_date_str = t1_dt.isoformat()
    yest_prev_date_str = (t1_dt - timedelta(days=1)).isoformat()

    l7_start_dt = t1_dt - timedelta(days=6)
    l7_start_str = l7_start_dt.isoformat()
    l7_prev_end_dt = l7_start_dt - timedelta(days=1)
    l7_prev_start_dt = l7_prev_end_dt - timedelta(days=6)
    l7_prev_start_str = l7_prev_start_dt.isoformat()
    l7_prev_end_str = l7_prev_end_dt.isoformat()

    mtd_start_dt = date(t1_dt.year, t1_dt.month, 1)
    mtd_start_str = mtd_start_dt.isoformat()
    mtd_days = (t1_dt - mtd_start_dt).days + 1
    last_day_prev_month = mtd_start_dt - timedelta(days=1)
    prev_month_start_dt = last_day_prev_month - timedelta(days=mtd_days - 1)
    mtd_prev_start_str = prev_month_start_dt.isoformat()
    mtd_prev_end_str = last_day_prev_month.isoformat()

    try:
        min_dt = datetime.fromisoformat(DATA_MIN_DATE).date()
    except Exception:
        min_dt = date(2026, 10, 13)
    total_days = max(1, (t1_dt - min_dt).days + 1)

    yest_label = t1_dt.strftime("%d %b %Y")
    l7_label = f"{l7_start_dt.strftime('%d %b')} – {t1_dt.strftime('%d %b')}"
    mtd_label = f"{mtd_start_dt.strftime('%d %b')} – {t1_dt.strftime('%d %b')}"
    all_label = f"{min_dt.strftime('%d %b')} – {t1_dt.strftime('%d %b')} ({total_days}d)"

    hero_sql = f"""
    SELECT
        -- Yesterday ({yest_date_str})
        COALESCE(SUM(CASE WHEN bill_date = '{yest_date_str}' THEN amount_incl_gst END), 0) AS yest_sales,
        COUNT(DISTINCT CASE WHEN bill_date = '{yest_date_str}' AND txn_type = 'Sale' THEN bill_key END) AS yest_bills,
        COALESCE(SUM(CASE WHEN bill_date = '{yest_prev_date_str}' THEN amount_incl_gst END), 0) AS yest_prev_sales,
        COUNT(DISTINCT CASE WHEN bill_date = '{yest_prev_date_str}' AND txn_type = 'Sale' THEN bill_key END) AS yest_prev_bills,

        -- Last 7D ({l7_start_str} to {yest_date_str})
        COALESCE(SUM(CASE WHEN bill_date BETWEEN '{l7_start_str}' AND '{yest_date_str}' THEN amount_incl_gst END), 0) AS l7_sales,
        COUNT(DISTINCT CASE WHEN bill_date BETWEEN '{l7_start_str}' AND '{yest_date_str}' AND txn_type = 'Sale' THEN bill_key END) AS l7_bills,
        COALESCE(SUM(CASE WHEN bill_date BETWEEN '{l7_prev_start_str}' AND '{l7_prev_end_str}' THEN amount_incl_gst END), 0) AS l7_prev_sales,
        COUNT(DISTINCT CASE WHEN bill_date BETWEEN '{l7_prev_start_str}' AND '{l7_prev_end_str}' AND txn_type = 'Sale' THEN bill_key END) AS l7_prev_bills,

        -- MTD ({mtd_start_str} to {yest_date_str})
        COALESCE(SUM(CASE WHEN bill_date BETWEEN '{mtd_start_str}' AND '{yest_date_str}' THEN amount_incl_gst END), 0) AS mtd_sales,
        COUNT(DISTINCT CASE WHEN bill_date BETWEEN '{mtd_start_str}' AND '{yest_date_str}' AND txn_type = 'Sale' THEN bill_key END) AS mtd_bills,
        COALESCE(SUM(CASE WHEN bill_date BETWEEN '{mtd_prev_start_str}' AND '{mtd_prev_end_str}' THEN amount_incl_gst END), 0) AS mtd_prev_sales,
        COUNT(DISTINCT CASE WHEN bill_date BETWEEN '{mtd_prev_start_str}' AND '{mtd_prev_end_str}' AND txn_type = 'Sale' THEN bill_key END) AS mtd_prev_bills,

        -- All Data ({DATA_MIN_DATE} to {yest_date_str})
        COALESCE(SUM(CASE WHEN bill_date <= '{yest_date_str}' THEN amount_incl_gst END), 0) AS all_sales,
        COUNT(DISTINCT CASE WHEN bill_date <= '{yest_date_str}' AND txn_type = 'Sale' THEN bill_key END) AS all_bills
    FROM `{VIEW_NAME}`
    WHERE {where_hero}
    """
    try:
        hero_raw_rows = execute_query(hero_sql, params_hero)
        hr = hero_raw_rows[0] if hero_raw_rows else {}
    except Exception as e:
        logger.error(f"Error executing hero_sql: {e}")
        hr = {}

    # Extract 14-day sparkline from recent days
    recent_14_sparkline = [round(d["net_sales_incl_gst"], 2) for d in daily_rows[-14:]] if daily_rows else []

    hero_strip = [
        {
            "id": "yesterday",
            "label": "Yesterday",
            "period_label": yest_label,
            "net_sales": round(hr.get("yest_sales", 0), 2),
            "bills": hr.get("yest_bills", 0),
            "aov": round(hr.get("yest_sales", 0) / hr.get("yest_bills", 1), 2) if hr.get("yest_bills", 0) > 0 else 0,
            "prev_sales": round(hr.get("yest_prev_sales", 0), 2),
            "sparkline": recent_14_sparkline[-7:] if len(recent_14_sparkline) >= 7 else recent_14_sparkline
        },
        {
            "id": "last7",
            "label": "Last 7 Days",
            "period_label": l7_label,
            "net_sales": round(hr.get("l7_sales", 0), 2),
            "bills": hr.get("l7_bills", 0),
            "aov": round(hr.get("l7_sales", 0) / hr.get("l7_bills", 1), 2) if hr.get("l7_bills", 0) > 0 else 0,
            "prev_sales": round(hr.get("l7_prev_sales", 0), 2),
            "sparkline": recent_14_sparkline[-7:] if len(recent_14_sparkline) >= 7 else recent_14_sparkline
        },
        {
            "id": "mtd",
            "label": "Month to Date",
            "period_label": mtd_label,
            "net_sales": round(hr.get("mtd_sales", 0), 2),
            "bills": hr.get("mtd_bills", 0),
            "aov": round(hr.get("mtd_sales", 0) / hr.get("mtd_bills", 1), 2) if hr.get("mtd_bills", 0) > 0 else 0,
            "prev_sales": round(hr.get("mtd_prev_sales", 0), 2),
            "sparkline": recent_14_sparkline
        },
        {
            "id": "all",
            "label": "All Data",
            "period_label": all_label,
            "net_sales": round(hr.get("all_sales", 0), 2),
            "bills": hr.get("all_bills", 0),
            "aov": round(hr.get("all_sales", 0) / hr.get("all_bills", 1), 2) if hr.get("all_bills", 0) > 0 else 0,
            "prev_sales": None,
            "sparkline": recent_14_sparkline
        }
    ]

    # Waterfalls
    waterfall_net = [
        {"name": "Gross Sales", "amount": kpi_curr.get("gross_sales", 0), "type": "positive"},
        {"name": "Returns", "amount": -abs(kpi_curr.get("returns", 0)), "type": "negative"},
        {"name": "Exchanges", "amount": kpi_curr.get("exchanges", 0), "type": "positive"},
        {"name": "Net Sales", "amount": kpi_curr.get("net_sales_incl_gst", 0), "type": "total"}
    ]

    waterfall_price = [
        {"name": "MRP Value", "amount": kpi_curr.get("mrp_value", 0), "type": "positive"},
        {"name": "Discounts", "amount": -abs(kpi_curr.get("discount", 0)), "type": "negative"},
        {"name": "Paid (incl. GST)", "amount": kpi_curr.get("net_sales_incl_gst", 0), "type": "subtotal"},
        {"name": "GST", "amount": -abs(kpi_curr.get("gst", 0)), "type": "negative"},
        {"name": "Sales ex-GST", "amount": kpi_curr.get("net_sales_ex_gst", 0), "type": "subtotal"},
        {"name": "COGS (Cost)", "amount": -abs(kpi_curr.get("cost", 0)), "type": "negative"},
        {"name": "Gross Margin", "amount": kpi_curr.get("gross_margin", 0), "type": "total"}
    ]

    # Categorized Insights (Risks, Opportunities, Notable with Rupee Impact)
    insights = []
    network_discount_pct = kpi_curr.get("discount_pct", 0)
    network_return_rate = kpi_curr.get("return_rate", 0)

    # 1. RISK: Stores with excessive discount giveaway
    store_disc_sql = f"""
    SELECT
        store_name,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN discount ELSE 0 END), 0) AS sale_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN mrp_value ELSE 0 END), 0) AS sale_mrp_value,
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales
    FROM `{VIEW_NAME}`
    WHERE {where_curr}
    GROUP BY store_name
    HAVING sale_mrp_value > 50000
    """
    try:
        store_disc_rows = execute_query(store_disc_sql, params_curr)
    except Exception as e:
        logger.error(f"Error executing store_disc_sql: {e}")
        store_disc_rows = []
    excess_discount_stores = []
    for s in store_disc_rows:
        d_pct = (s["sale_discount"] / s["sale_mrp_value"]) * 100.0 if s["sale_mrp_value"] > 0 else 0
        diff_pp = d_pct - network_discount_pct
        if diff_pp >= INSIGHT_THRESHOLDS["store_discount_excess_pp"]:
            rupee_impact = round(s["sale_mrp_value"] * (diff_pp / 100.0), 2)
            excess_discount_stores.append({
                "store_name": s["store_name"],
                "discount_pct": round(d_pct, 1),
                "diff_pp": round(diff_pp, 1),
                "rupee_impact": rupee_impact,
                "net_sales": s["net_sales"]
            })

    if excess_discount_stores:
        excess_discount_stores.sort(key=lambda x: x["rupee_impact"], reverse=True)
        top_disc = excess_discount_stores[0]
        insights.append({
            "id": "risk_discount_excess",
            "group": "Risks",
            "severity": "warning",
            "headline": f"Discount Giveaway: {top_disc['store_name']}",
            "description": f"Discount rate of {top_disc['discount_pct']}% is {top_disc['diff_pp']}pp above network average.",
            "rupee_impact": top_disc["rupee_impact"],
            "impact_label": f"₹{top_disc['rupee_impact']:,.0f} margin erosion",
            "metric": "Discount %",
            "link": f"/stores?store={top_disc['store_name']}"
        })

    # 2. RISK: Dormant Stores
    zero_sales_sql = f"""
    SELECT
        store_name,
        store_type,
        MAX(bill_date) AS last_active_date
    FROM `{VIEW_NAME}`
    WHERE bill_date >= '{DATA_MIN_DATE}' AND bill_date <= '{yest_date_str}'
    GROUP BY store_name, store_type
    HAVING last_active_date < DATE_SUB(DATE('{yest_date_str}'), INTERVAL {INSIGHT_THRESHOLDS['stores_zero_sales_days']} DAY)
    """
    try:
        zero_sales_stores = execute_query(zero_sales_sql)
    except Exception as e:
        logger.error(f"Error executing zero_sales_sql: {e}")
        zero_sales_stores = []
    if zero_sales_stores:
        s_names = [z["store_name"] for z in zero_sales_stores]
        insights.append({
            "id": "risk_dormant_stores",
            "group": "Risks",
            "severity": "negative",
            "headline": f"{len(zero_sales_stores)} Stores with No Sales in 3+ Days",
            "description": f"Dormant: {', '.join(s_names[:3])}{' and others' if len(s_names) > 3 else ''} since {zero_sales_stores[0]['last_active_date']}.",
            "rupee_impact": len(zero_sales_stores) * 25000,
            "impact_label": f"~₹{len(zero_sales_stores)*25000:,.0f} lost daily run-rate",
            "metric": "Store Activity",
            "link": "/health"
        })

    # 3. OPPORTUNITY: High Margin Low Discount Stores
    high_margin_stores = [s for s in sorted_stores if s["share_pct"] > 3.0][:2]
    if high_margin_stores:
        best_store = high_margin_stores[0]
        insights.append({
            "id": "opp_top_volume_builder",
            "group": "Opportunities",
            "severity": "positive",
            "headline": f"Anchor Store: {best_store['store_name']}",
            "description": f"Generates {best_store['share_pct']}% of total network sales with steady volume.",
            "rupee_impact": best_store["net_sales"],
            "impact_label": f"₹{best_store['net_sales']:,.0f} net sales",
            "metric": "Store Volume",
            "link": f"/stores?store={best_store['store_name']}"
        })

    # 4. NOTABLE: Weekend vs Weekday Lift
    if dow_list:
        sorted_dow = sorted(dow_list, key=lambda x: x["avg_sales"], reverse=True)
        best_day = sorted_dow[0]
        worst_day = sorted_dow[-1]
        lift = round(((best_day["avg_sales"] - worst_day["avg_sales"]) / worst_day["avg_sales"]) * 100.0, 1) if worst_day["avg_sales"] > 0 else 0
        insights.append({
            "id": "notable_dow_pattern",
            "group": "Notable",
            "severity": "info",
            "headline": f"Peak Trading: {best_day['day_name']} (+{lift}% vs {worst_day['day_name']})",
            "description": f"Averages ₹{best_day['avg_sales']:,.0f} per {best_day['day_name']}. Ensure high-volume staffing on peak days.",
            "rupee_impact": best_day["avg_sales"],
            "impact_label": f"₹{best_day['avg_sales']:,.0f} avg day",
            "metric": "Day of Week",
            "link": "/overview"
        })

    # Sort insights by rupee impact descending
    insights.sort(key=lambda x: x.get("rupee_impact", 0), reverse=True)

    result = {
        "hero_strip": hero_strip,
        "kpi_current": kpi_curr,
        "kpi_previous": kpi_prev,
        "daily_trend": daily_rows,
        "day_of_week": dow_list,
        "hourly_distribution": hourly_rows,
        "store_type_split": split_rows,
        "top_stores": top_5,
        "bottom_stores": bottom_5,
        "too_few_bills_stores": too_few_bills,
        "no_sales_stores": no_sales_stores,
        "new_stores_excluded": new_stores_excluded,
        "total_trading_stores": total_trading_stores,
        "total_universe_stores": len(universe_keys),
        "is_single_day": s_date == e_date,
        "network_net_sales": round(total_store_sales, 2),
        "pareto_stores": pareto_stores,
        "stores_for_80_pct": stores_for_80_pct,
        "waterfall_net": waterfall_net,
        "waterfall_price": waterfall_price,
        "insights": insights,
        "meta": {
            "start_date": s_date,
            "end_date": e_date,
            "prev_start_date": prev_s_date,
            "prev_end_date": prev_e_date,
            "store_type": store_type,
            "as_of_date": yest_date_str
        }
    }

    cache.set("overview", cache_params, result)
    return result

@router.get("/drilldown")
def get_metric_drilldown(
    metric: str = Query("net_sales_incl_gst"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_type: Optional[str] = Query(DEFAULT_STORE_TYPE),
    regions: Optional[List[str]] = Query(None),
    stores: Optional[List[str]] = Query(None),
    genders: Optional[List[str]] = Query(None),
    departments: Optional[List[str]] = Query(None),
    product: Optional[str] = Query(None),
):
    """
    Provides drilldown breakdown for a selected metric:
    - Daily trend
    - Split by Store Type (Own vs Franchise)
    - Top 10 Contributing Stores
    - Top 10 Contributing Products
    """
    e_date = end_date or DATA_MAX_DATE
    if start_date:
        s_date = start_date
    else:
        try:
            e_dt_calc = datetime.fromisoformat(e_date).date()
            s_date = (e_dt_calc - timedelta(days=6)).isoformat()
        except Exception:
            s_date = "2026-11-10"
    if s_date < DATA_MIN_DATE:
        s_date = DATA_MIN_DATE
    if e_date < s_date:
        e_date = s_date

    cache_params = {
        "m": metric, "s": s_date, "e": e_date, "st": store_type,
        "reg": ",".join(sorted(regions)) if regions else "",
        "sto": ",".join(sorted(stores)) if stores else "",
        "gen": ",".join(sorted(genders)) if genders else "",
        "dep": ",".join(sorted(departments)) if departments else "",
        "p": product or ""
    }
    cached = cache.get("drilldown", cache_params)
    if cached:
        return cached

    where_sql, params = build_filter_clause(
        start_date=s_date,
        end_date=e_date,
        store_type=store_type,
        regions=regions,
        stores=stores,
        genders=genders,
        departments=departments,
        product_search=product,
        prefix="dd"
    )

    # Determine metric expression
    expr_map = {
        "net_sales_incl_gst": "SUM(amount_incl_gst)",
        "net_sales_ex_gst": "SUM(sales_ex_gst)",
        "gross_sales": "SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END)",
        "returns": "ABS(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END))",
        "exchanges": "SUM(CASE WHEN txn_type = 'Exchange' THEN amount_incl_gst ELSE 0 END)",
        "net_units": "SUM(units)",
        "bills": "COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END)",
        "gross_margin": "SUM(gross_margin)",
    }
    sql_expr = expr_map.get(metric, "SUM(amount_incl_gst)")

    # 1. Daily trend
    daily_sql = f"""
    SELECT
        bill_date,
        COALESCE({sql_expr}, 0) AS value
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY bill_date
    ORDER BY bill_date
    """
    daily_trend = execute_query(daily_sql, params)

    # 2. By store type
    type_sql = f"""
    SELECT
        store_type,
        COALESCE({sql_expr}, 0) AS value
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_type
    ORDER BY value DESC
    """
    by_type = execute_query(type_sql, params)

    # 3. Top 10 stores
    top_stores_sql = f"""
    SELECT
        store_name,
        store_type,
        COALESCE({sql_expr}, 0) AS value
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY store_name, store_type
    ORDER BY value DESC
    LIMIT 10
    """
    top_stores = execute_query(top_stores_sql, params)

    # 4. Top 10 products
    top_prods_sql = f"""
    SELECT
        product_name,
        COALESCE({sql_expr}, 0) AS value
    FROM `{VIEW_NAME}`
    WHERE {where_sql}
    GROUP BY product_name
    ORDER BY value DESC
    LIMIT 10
    """
    top_prods = execute_query(top_prods_sql, params)

    meta_def = METRIC_REGISTRY.get(metric)
    result = {
        "metric_key": metric,
        "label": meta_def.label if meta_def else metric,
        "definition": meta_def.definition if meta_def else "",
        "tooltip": meta_def.tooltip if meta_def else "",
        "daily_trend": daily_trend,
        "by_store_type": by_type,
        "top_stores": top_stores,
        "top_products": top_prods
    }
    cache.set("drilldown", cache_params, result)
    return result
