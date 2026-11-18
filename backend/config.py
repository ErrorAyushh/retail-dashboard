"""
Kadam Configuration Module
Configuration settings for offline retail sales dashboard.
"""
import os
from pydantic import BaseModel

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "centeral-analytics-bq")
BQ_LOCATION = os.getenv("BQ_LOCATION", "asia-south1")
VIEW_NAME = os.getenv("RETAIL_VIEW", "centeral-analytics-bq.retail_data.v_retail_lines")

MAX_BYTES_BILLED = int(os.getenv("MAX_BYTES_BILLED", 500 * 1024 * 1024))  # 500 MB safety cap
QUERY_TIMEOUT_SECONDS = int(os.getenv("QUERY_TIMEOUT_SECONDS", 45))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 3600))  # 1 hour TTL (3600 seconds)

# Configurable default store type
DEFAULT_STORE_TYPE = os.getenv("DEFAULT_STORE_TYPE", "All")  # "All" | "Own store" | "Franchise"

# Date bounds discovered from data
DATA_MIN_DATE = "2026-10-13"
DATA_MAX_DATE = "2026-11-16"

# Thresholds for automated rule-based insights
INSIGHT_THRESHOLDS = {
    "store_sales_drop_pct": 20.0,       # Store net sales down > 20% vs prev period
    "store_sales_drop_min_rev": 50000,   # Min revenue in previous period to trigger drop alert
    "store_discount_excess_pp": 5.0,    # Store discount % > 5pp above network avg
    "product_return_rate_mult": 2.0,    # Product return rate > 2x network avg
    "product_return_min_units": 20,     # Min units sold to trigger return rate alert
    "stores_zero_sales_days": 3,        # Stores with 0 sales in the last N days
    "staff_min_bills": 20,              # Minimum bills to rank staff in leaderboard
}
