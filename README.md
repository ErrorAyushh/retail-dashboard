# Kadam — Neemans Offline Retail Sales Dashboard

**Kadam** is the offline retail (store) sales intelligence dashboard for Neemans, built as a sibling of the **Pulse** D2C dashboard. It uses the exact same stack, design system, components, filter semantics, and Indian number formatting.

- **Subdomain:** `kadam`
- **Backend:** FastAPI (Python 3.11+) + BigQuery (`centeral-analytics-bq`, location `asia-south1`)
- **Frontend:** React 19 + Vite + Tailwind CSS 4 + Recharts + Lucide Icons
- **Data Source:** `centeral-analytics-bq.retail_data.v_retail_lines` (Single Source of Truth, Read-Only)

---

## 1. Environment Variables & Configuration

Backend configuration lives in `backend/config.py` and can be overridden via environment variables or a `.env` file:

| Variable | Default Value | Description |
|---|---|---|
| `GCP_PROJECT_ID` | `centeral-analytics-bq` | Google Cloud project ID hosting BigQuery |
| `BQ_LOCATION` | `asia-south1` | BigQuery regional dataset location |
| `RETAIL_VIEW` | `centeral-analytics-bq.retail_data.v_retail_lines` | Read-only single source of truth view |
| `MAX_BYTES_BILLED` | `104857600` (100 MB) | Safety cap per query execution |
| `QUERY_TIMEOUT_SECONDS` | `45` | Query execution timeout in seconds |
| `CACHE_TTL_SECONDS` | `900` (15 minutes) | In-memory response cache TTL |
| `DEFAULT_STORE_TYPE` | `Own store` | Default store filter (`Own store` \| `Franchise` \| `All`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC / gcloud auth | Path to service account key JSON (optional if using ADC) |

---

## 2. Service Account & BigQuery Setup

The backend connects to BigQuery using the standard `google-cloud-bigquery` client with `location="asia-south1"`:

1. **Local Development:**
   Authenticate via Google Cloud SDK Application Default Credentials (ADC):
   ```bash
   gcloud auth application-default login
   ```
2. **Production / Subdomain Hosting (`kadam`):**
   Set `GOOGLE_APPLICATION_CREDENTIALS` to a read-only service account key:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/kadam-reader-sa.json"
   ```
   **Required BigQuery IAM Roles:**
   - `roles/bigquery.jobUser` on project `centeral-analytics-bq`
   - `roles/bigquery.dataViewer` on dataset `retail_data` (read-only view access)

*BigQuery is strictly read-only for Kadam: no tables or views are created, altered, or deleted.*

---

## 3. Cache Architecture

- Kadam uses an in-memory TTL cache (`backend/cache.py`) with a **15-minute TTL** (`CACHE_TTL_SECONDS = 900`).
- Because offline store data arrives once daily (completed days only, T-1), queries for identical filter combinations return instantly with zero BigQuery scan cost.
- Cache keys are generated via SHA-256 of the normalized, sorted query parameters.

---

## 4. How to Add a New Metric

Every metric in Kadam follows a centralized single-source-of-truth pattern defined in `backend/metrics.py`:

1. **Register the Metric in `METRIC_REGISTRY` (`backend/metrics.py`):**
   ```python
   "my_metric": MetricDefinition(
       key="my_metric",
       label="My Metric Name",
       definition="SQL Formula e.g. SUM(x) / COUNT(y)",
       tooltip="User-facing tooltip description shown on the KPI card info icon",
       unit="currency",      # 'currency' | 'percent' | 'number' | 'ratio'
       invert_badge=False,   # True if increase is unfavorable (e.g. returns/discounts)
       footnote="Optional footnote text (e.g. for margin discrepancies)"
   )
   ```
2. **Add SQL Aggregation in `get_sql_metric_aggregates()`:**
   Add the SQL expressions to `get_sql_metric_aggregates()` so it is computed in the single-scan base queries.
3. **Compute Derived Value in `compute_derived_metrics()`:**
   Add any derived ratio or division (with zero-division guards).
4. **Use on Frontend:**
   Pass `term="my_metric"` to any `<MetricCard />` or `<InfoTip term="my_metric" />` component. The label, formula, and tooltip are populated automatically.

---

## 5. Assumptions Made & Cost Safety

1. **No Queries Exceeded the Byte Cap:**
   - Every executed BigQuery query scanned approximately **7.3 MB** and billed **10 MB** (BigQuery's minimum 10 MB tier).
   - All queries executed well within the **100 MB** (`MAX_BYTES_BILLED`) cap.
2. **History Boundary:**
   - Data exists strictly from **13 Oct 2026 to 16 Nov 2026** (approx. 5 weeks, 55 stores).
   - The UI automatically clamps custom date pickers between `2026-10-13` and `2026-11-16`.
   - No YoY or live-today metrics are exposed.
3. **Franchise Figures:**
   - Franchise store figures reflect customer sell-out prices. When "All" stores is selected, a banner informs the user: *"Includes franchise sell-out"*.
4. **PII Protection:**
   - Customer mobile numbers, customer codes, names, and GST numbers are masked by default (`XXXXXX1234` and initials).
   - An authorized role (`can_view_pii`) can view unmasked data. No PII is logged in application logs.
5. **Dormant Stores:**
   - 1 franchise store (`SURAT VR MALL`) recorded zero sales in the last 3 days, and is highlighted in the Data Health drawer/page.

---

## 6. How to Run Locally

### Start Backend (Port 8000)
```bash
# In workspace root
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Start Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser. The Vite development server automatically proxies all `/api` requests to the FastAPI backend at `http://127.0.0.1:8000`.

### Production Build
```bash
cd frontend
npm run build
```
The optimized bundle is written to `frontend/dist/`.

---

## 7. Geography & Store Location Module

Kadam features a **Geography** intelligence page showing retail sales, margin, discount, and returns across **16 states, 34 cities, and 4 macro zones** with an interactive India map.

### Data Model & Static Config (`config/store_geo.json`)
- The BigQuery view `v_retail_lines` contains inconsistent location columns (7 stores with missing `city_raw`, messy casing, and misspellings like `F_Gandhidham_Gujarat` tagged as Ahmedabad).
- To preserve BigQuery read-only integrity, all geography mappings, standardized states, zones, and approximate city coordinates live in `config/store_geo.json`.
- At API startup and on every request, `backend/geo.py` validates that all stores in the database exist in the config. Any missing store is flagged under `unmapped_stores` and raises an alert on the Data Health page.

### GeoJSON Source & License
- **File:** `frontend/src/assets/india_states.json` and pre-projected `frontend/src/assets/india_states_paths.json`.
- **Source:** Open Administrative Boundaries for India (maintained by Datameet / OpenStreetMap community; standard jbrobst India States GeoJSON including Telangana).
- **License:** Open Database License (ODbL) v1.0 / Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0).
- **Note:** Geometry coordinates are bundled locally inside the repo with 0 external map tile or third-party API dependencies.

### Acceptance Test Reconciliation (13 Oct – 16 Nov 2026, All Stores)
| Check | Expected | Verified Result | Status |
|---|---|---|---|
| Stores Mapped | 55 (39 own, 16 franchise) | 55 (39 own, 16 franchise), 0 unmapped | PASS |
| States Covered | 16 | 16 | PASS |
| Telangana | 7 stores, ₹1,08,00,761 | 7 stores, ₹1,08,00,760.39 (rounds to ₹1,08,00,761) | PASS |
| Maharashtra | 7 stores (6 own, 1 fran), ₹1,13,40,951 | 7 stores (6 own, 1 fran), ₹1,13,40,951.45 (rounds to ₹1,13,40,951) | PASS |
| Gujarat | 12 stores (11 fran, 1 own), ₹1,38,67,941 | 12 stores (11 fran, 1 own), ₹1,38,67,941.85 (rounds to ₹1,38,67,941) | PASS |
| Multi-Store Cities | Hyderabad 7, Ahmedabad 6, Mumbai 4, Bengaluru 4 | Hyderabad 7, Ahmedabad 6, Mumbai 4, Bengaluru 4 | PASS |
| New Stores Flagged | 3 (Nashik, ASRao Hyderabad, Ludhiana) | 3 stores flagged | PASS |
| Sum of State Table | Equals Overview Net Sales (₹70,226,111.64) | ₹70,226,111.64 | PASS |
| Sum of City Table | Equals Sum of State Table | ₹70,226,111.64 | PASS |
| Own + Franchise | Equals All Stores Total | ₹53,160,898.83 + ₹17,065,212.81 = ₹70,226,111.64 | PASS |

