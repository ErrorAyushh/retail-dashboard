"""
Data Health router for Kadam dashboard.
Exposes data freshness, pipeline integrity checks, dormant stores, and data caveats.
"""
from fastapi import APIRouter
from backend.db import execute_query
from backend.cache import cache
from backend.config import VIEW_NAME, DATA_MIN_DATE
from backend.geo import validate_stores

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("")
def get_data_health():
    cached = cache.get("health:summary", {})
    if cached:
        return cached

    # 1. Main pipeline counts & integrity
    sql = f"""
    SELECT
        COUNT(*) AS total_rows,
        MAX(bill_date) AS max_bill_date,
        MIN(bill_date) AS min_bill_date,
        MAX(pulled_at) AS max_pulled_at,
        COUNT(DISTINCT store_name) AS total_stores,
        COUNT(DISTINCT CASE WHEN bill_date = (SELECT MAX(bill_date) FROM `{VIEW_NAME}`) THEN store_name END) AS stores_reporting_yesterday,
        COUNTIF(cost_filled = true) AS lines_cost_filled,
        COUNTIF(unit_cost = 0) AS lines_zero_unit_cost,
        COUNTIF(has_gstin = true) AS lines_with_gstin,
        COUNTIF(customer_key IS NULL OR customer_mobile IS NULL) AS lines_missing_mobile
    FROM `{VIEW_NAME}`
    """
    rows = execute_query(sql)
    h = rows[0] if rows else {}

    # 2. Stores with no sales in the last 3 days
    dormant_sql = f"""
    SELECT
        store_name,
        store_type,
        region,
        MAX(bill_date) AS last_active_date,
        DATE_DIFF((SELECT MAX(bill_date) FROM `{VIEW_NAME}` WHERE bill_date >= '{DATA_MIN_DATE}'), MAX(bill_date), DAY) AS days_dormant
    FROM `{VIEW_NAME}`
    WHERE bill_date >= '{DATA_MIN_DATE}' AND bill_date <= CURRENT_DATE('Asia/Kolkata')
    GROUP BY store_name, store_type, region
    HAVING days_dormant >= 3
    ORDER BY days_dormant DESC
    """
    dormant_stores = execute_query(dormant_sql)

    # 3. Check for unmapped stores against store_geo.json
    all_stores_sql = f"SELECT DISTINCT store_name FROM `{VIEW_NAME}` WHERE store_name IS NOT NULL"
    store_rows = execute_query(all_stores_sql)
    all_store_names = [r["store_name"] for r in store_rows]
    unmapped_stores = validate_stores(all_store_names)

    # 4. Known data caveats checklist
    caveats = []
    if unmapped_stores:
        caveats.append({
            "id": "unmapped_stores_warning",
            "title": f"{len(unmapped_stores)} new stores need a location",
            "severity": "warning",
            "description": f"The following stores are missing in config/store_geo.json: {', '.join(unmapped_stores)}. Please add them to provide city/state/coordinates."
        })
    caveats.extend([
        {
            "id": "business_type_unreliable",
            "title": "Unreliable business_type Dimension",
            "severity": "warning",
            "description": "Around 3% of sales are tagged B2B but appear to be normal retail bills. One franchise store tags ~60% of bills as B2B. Do not use business_type for wholesale vs retail splits."
        },
        {
            "id": "city_raw_unreliable",
            "title": "Unreliable city_raw Dimension",
            "severity": "warning",
            "description": "city_raw contains messy tags (e.g., Gandhidham and 4D Square tagged Ahmedabad). System groups strictly by verified store_name and region."
        },
        {
            "id": "franchise_sell_out",
            "title": "Franchise Store Sell-Out Value",
            "severity": "info",
            "description": "Franchise figures reflect end-consumer sell-out bill amounts, not Neemans wholesale revenue to franchise partners."
        },
        {
            "id": "cost_filled_exchange",
            "title": "Filled Costs on Zero Cost / Exchange Rows",
            "severity": "info",
            "description": f"Cost is Wondersoft ItemCost x Quantity. Zero costs (primarily exchanges) are filled from the latest non-zero cost for the same EAN ({h.get('lines_cost_filled', 0)} lines filled)."
        },
        {
            "id": "window_history",
            "title": "Data History Window",
            "severity": "info",
            "description": f"History begins 13 Oct 2026 and updates dynamically up to T-1 ({h.get('max_bill_date', 'latest')}). Store network expanded from 52 to 55 stores during this window."
        }
    ])

    result = {
        "status": "warning" if (len(dormant_stores) >= 5 or unmapped_stores) else "healthy",
        "total_rows": h.get("total_rows", 0),
        "max_bill_date": str(h.get("max_bill_date", "")),
        "min_bill_date": str(h.get("min_bill_date", "")),
        "max_pulled_at": str(h.get("max_pulled_at", "")),
        "total_stores": h.get("total_stores", 0),
        "stores_reporting_yesterday": h.get("stores_reporting_yesterday", 0),
        "lines_cost_filled": h.get("lines_cost_filled", 0),
        "lines_zero_unit_cost": h.get("lines_zero_unit_cost", 0),
        "lines_with_gstin": h.get("lines_with_gstin", 0),
        "lines_missing_mobile": h.get("lines_missing_mobile", 0),
        "dormant_stores": dormant_stores,
        "unmapped_stores": unmapped_stores,
        "caveats": caveats
    }

    cache.set("health:summary", {}, result)
    return result
