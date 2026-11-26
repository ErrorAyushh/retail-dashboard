"""
Main FastAPI application entrypoint for Kadam (Offline Retail Dashboard).
Configured with strict CORS, GZip compression, timing/logging middleware,
Google OAuth + signed JWT authentication, and pre-warmed cache support.
"""
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.config import (
    CORS_ORIGINS,
    DEFAULT_STORE_TYPE,
    DATA_MIN_DATE
)
from backend.metrics import METRIC_REGISTRY
from backend.middleware import RequestLoggingMiddleware
from backend.auth import get_current_user
from backend.routers import (
    auth,
    warmup,
    filters,
    overview,
    stores,
    geography,
    products,
    discounts,
    returns,
    staff,
    customers,
    health
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kadam")

app = FastAPI(
    title="Kadam Retail Dashboard API",
    description="Offline Retail Sales Dashboard Backend for Neemans",
    version="1.0.0"
)

# 1. GZip compression middleware (minimum_size=1000 bytes)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. Strict CORS middleware (strictly from CORS_ORIGINS, localhost-only default)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Process-Time-Ms"]
)

# 3. Custom logging, PII scrubbing, timing, and X-Cache header middleware
app.add_middleware(RequestLoggingMiddleware)

# Public health check endpoint
@app.get("/health")
def health_check():
    """Public health check endpoint for container and load-balancer probes."""
    return {"status": "ok", "app": "kadam", "subdomain": "kadam"}

# Public auth endpoints (login, exchange Google token)
app.include_router(auth.router)

# Cache warmup endpoint (protected by X-Warmup-Secret header)
app.include_router(warmup.router)

# Protected data routers (require valid signed Bearer token)
app.include_router(filters.router, dependencies=[Depends(get_current_user)])
app.include_router(overview.router, dependencies=[Depends(get_current_user)])
app.include_router(stores.router, dependencies=[Depends(get_current_user)])
app.include_router(geography.router, dependencies=[Depends(get_current_user)])
app.include_router(products.router, dependencies=[Depends(get_current_user)])
app.include_router(discounts.router, dependencies=[Depends(get_current_user)])
app.include_router(returns.router, dependencies=[Depends(get_current_user)])
app.include_router(staff.router, dependencies=[Depends(get_current_user)])
app.include_router(customers.router, dependencies=[Depends(get_current_user)])
app.include_router(health.router, dependencies=[Depends(get_current_user)])

# Protected metric definitions registry
@app.get("/api/metrics/registry", dependencies=[Depends(get_current_user)])
def get_metrics_registry():
    """
    Returns complete single-source-of-truth registry of metrics, definitions, and tooltips
    for frontend InfoTip components and documentation.
    """
    return {
        key: {
            "key": m.key,
            "label": m.label,
            "definition": m.definition,
            "tooltip": m.tooltip,
            "unit": m.unit,
            "invert_badge": m.invert_badge,
            "footnote": m.footnote,
        }
        for key, m in METRIC_REGISTRY.items()
    }

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=True)
