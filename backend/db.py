"""
Database access module for BigQuery.
Encapsulates read-only queries with strict safety caps, parameterized SQL, and timeouts.
"""
import os
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPICallError

from backend.config import (
    GCP_PROJECT_ID,
    BQ_LOCATION,
    VIEW_NAME,
    MAX_BYTES_BILLED,
    QUERY_TIMEOUT_SECONDS,
    DATA_MIN_DATE,
    DATA_MAX_DATE
)

logger = logging.getLogger("kadam.db")

_bq_client: Optional[bigquery.Client] = None

def get_client() -> bigquery.Client:
    global _bq_client
    if _bq_client is None:
        if "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ:
            adc_path = os.path.expandvars(r"%APPDATA%\gcloud\application_default_credentials.json")
            if os.path.exists(adc_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = adc_path
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID, location=BQ_LOCATION)
    return _bq_client

REGION_VARIANTS_MAP = {
    "Andhra Pradesh": ["Andhra Pradesh", "ANDHRA PRADESH", "andhra pradesh"],
    "Bihar": ["Bihar", "BIHAR", "bihar"],
    "Chhattisgarh": ["Chhattisgarh", "CHHATTISGARH", "chhattisgarh"],
    "Delhi": ["Delhi", "DELHI", "delhi"],
    "Goa": ["Goa", "GOA", "goa"],
    "Gujarat": ["Gujarat", "GUJARAT", "gujarat"],
    "Haryana": ["Haryana", "HARYANA", "haryana"],
    "Karnataka": ["Karnataka", "KARNATAKA", "KARANATAKA", "karnataka", "karanataka"],
    "Kerala": ["Kerala", "KERALA", "kerala"],
    "Madhya Pradesh": ["Madhya Pradesh", "MADHYA PRADESH", "madhya pradesh"],
    "Maharashtra": ["Maharashtra", "MAHARASHTRA", "maharashtra"],
    "Punjab": ["Punjab", "PUNJAB", "punjab"],
    "Rajasthan": ["Rajasthan", "RAJASTHAN", "rajasthan"],
    "Telangana": ["Telangana", "TELANGANA", "telangana"],
    "Uttar Pradesh": ["Uttar Pradesh", "UTTAR PRADESH", "uttar pradesh"],
    "Uttarakhand": ["Uttarakhand", "UTTARAKHAND", "uttarakhand"],
}

def build_filter_clause(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    store_type: Optional[str] = None,
    regions: Optional[List[str]] = None,
    stores: Optional[List[str]] = None,
    genders: Optional[List[str]] = None,
    departments: Optional[List[str]] = None,
    product_search: Optional[str] = None,
    prefix: str = ""
) -> Tuple[str, List[bigquery.ScalarQueryParameter | bigquery.ArrayQueryParameter]]:
    """
    Constructs a safe WHERE clause using BigQuery query parameters.
    Returns (sql_where_condition, query_parameters).
    """
    clauses: List[str] = []
    params: List[Any] = []

    p_prefix = f"{prefix}_" if prefix else ""

    # Clamped dates (respect completed days from DATA_MIN_DATE onwards)
    if start_date or end_date:
        s_date = start_date if (start_date and start_date >= DATA_MIN_DATE) else DATA_MIN_DATE
        e_date = end_date if end_date else s_date
        if e_date < s_date:
            e_date = s_date

        clauses.append(f"bill_date >= @{p_prefix}start_date AND bill_date <= @{p_prefix}end_date")
        params.append(bigquery.ScalarQueryParameter(f"{p_prefix}start_date", "DATE", s_date))
        params.append(bigquery.ScalarQueryParameter(f"{p_prefix}end_date", "DATE", e_date))
    else:
        clauses.append(f"bill_date >= @{p_prefix}start_date")
        params.append(bigquery.ScalarQueryParameter(f"{p_prefix}start_date", "DATE", DATA_MIN_DATE))

    # Store type filter
    if store_type:
        st_norm = "Own store" if store_type in ["Own", "Own stores", "Own store"] else store_type
        if st_norm in ["Own store", "Franchise"]:
            clauses.append(f"store_type = @{p_prefix}store_type")
            params.append(bigquery.ScalarQueryParameter(f"{p_prefix}store_type", "STRING", st_norm))

    # Regions filter
    if regions:
        clean_regions = set()
        for r in regions:
            if not r or not r.strip():
                continue
            r_strip = r.strip()
            matched = False
            for can, vars in REGION_VARIANTS_MAP.items():
                if r_strip.upper() in [v.upper() for v in vars]:
                    clean_regions.update(vars)
                    matched = True
                    break
            if not matched:
                clean_regions.update([r_strip, r_strip.upper(), r_strip.title(), r_strip.lower()])

        if clean_regions:
            clauses.append(f"region IN UNNEST(@{p_prefix}regions)")
            params.append(bigquery.ArrayQueryParameter(f"{p_prefix}regions", "STRING", sorted(list(clean_regions))))

    # Stores filter (multi-select store_name)
    if stores:
        clean_stores = [s.strip() for s in stores if s and s.strip()]
        if clean_stores:
            clauses.append(f"store_name IN UNNEST(@{p_prefix}stores)")
            params.append(bigquery.ArrayQueryParameter(f"{p_prefix}stores", "STRING", clean_stores))

    # Gender filter
    if genders:
        clean_genders = [g.strip() for g in genders if g and g.strip()]
        if clean_genders:
            clauses.append(f"gender IN UNNEST(@{p_prefix}genders)")
            params.append(bigquery.ArrayQueryParameter(f"{p_prefix}genders", "STRING", clean_genders))

    # Department filter
    if departments:
        clean_depts = [d.strip() for d in departments if d and d.strip()]
        if clean_depts:
            clauses.append(f"department IN UNNEST(@{p_prefix}departments)")
            params.append(bigquery.ArrayQueryParameter(f"{p_prefix}departments", "STRING", clean_depts))

    # Product search (searches code or name)
    if product_search and product_search.strip():
        term = f"%{product_search.strip().lower()}%"
        clauses.append(f"(LOWER(product_name) LIKE @{p_prefix}prod_search OR LOWER(product_code) LIKE @{p_prefix}prod_search)")
        params.append(bigquery.ScalarQueryParameter(f"{p_prefix}prod_search", "STRING", term))

    where_sql = " AND ".join(clauses)
    return where_sql, params

def execute_query(sql: str, parameters: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    """
    Executes a read-only query with maximum_bytes_billed safety cap and timeout.
    """
    client = get_client()
    job_config = bigquery.QueryJobConfig(
        query_parameters=parameters or [],
        maximum_bytes_billed=MAX_BYTES_BILLED
    )

    start_time = time.time()
    try:
        query_job = client.query(
            sql,
            job_config=job_config,
            location=BQ_LOCATION,
            timeout=QUERY_TIMEOUT_SECONDS
        )
        results = [dict(row) for row in query_job.result()]
        elapsed = time.time() - start_time
        bytes_billed = query_job.total_bytes_billed or 0

        logger.info(
            f"Query succeeded: {len(results)} rows returned, "
            f"{bytes_billed / (1024 * 1024):.2f} MB billed in {elapsed:.2f}s"
        )
        return results
    except GoogleAPICallError as e:
        logger.error(f"BigQuery execution failed: {str(e)}")
        raise
