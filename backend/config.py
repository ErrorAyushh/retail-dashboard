"""
Kadam Configuration Module
Configuration settings for offline retail sales dashboard.
"""
import os
from typing import Set

ENV = os.getenv("ENV", "development")

# Security & Secrets (no default fallback secrets)
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", 24))
WARMUP_SECRET = os.getenv("WARMUP_SECRET")

# Production safety validation
if ENV == "production":
    if not JWT_SECRET or len(JWT_SECRET) < 32:
        raise RuntimeError(
            "CRITICAL: In production (ENV=production), JWT_SECRET must be set and at least 32 characters long."
        )

# CORS: strictly read from CORS_ORIGINS, localhost-only default
CORS_ORIGINS_RAW = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
)
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

# Authentication settings
ALLOWED_DOMAIN = "neemans.com"
ALLOWED_EMAILS_RAW = os.getenv("ALLOWED_EMAILS", "")
ALLOWED_EMAILS: Set[str] = {
    e.strip().lower() for e in ALLOWED_EMAILS_RAW.split(",") if e.strip()
}
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# BigQuery settings
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "centeral-analytics-bq")
BQ_LOCATION = os.getenv("BQ_LOCATION", "asia-south1")
VIEW_NAME = os.getenv("RETAIL_VIEW", "centeral-analytics-bq.retail_data.v_retail_lines")

MAX_BYTES_BILLED = int(os.getenv("MAX_BYTES_BILLED", 500 * 1024 * 1024))  # 500 MB safety cap
QUERY_TIMEOUT_SECONDS = int(os.getenv("QUERY_TIMEOUT_SECONDS", 45))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 1800))  # 30-minute TTL (1800 seconds)

# Default store type
DEFAULT_STORE_TYPE = os.getenv("DEFAULT_STORE_TYPE", "All")  # "All" | "Own store" | "Franchise"

# Date bounds
DATA_MIN_DATE = "2026-10-13"

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
