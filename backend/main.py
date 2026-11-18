"""
Main FastAPI application entrypoint for Kadam (Offline Retail Dashboard).
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import DEFAULT_STORE_TYPE, DATA_MIN_DATE, DATA_MAX_DATE
from backend.metrics import METRIC_REGISTRY
from backend.middleware import RequestLoggingMiddleware
from backend.routers import (
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

# CORS middleware for development and deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom logging and timing middleware
app.add_middleware(RequestLoggingMiddleware)

# Include page routers
app.include_router(filters.router)
app.include_router(overview.router)
app.include_router(stores.router)
app.include_router(geography.router)
app.include_router(products.router)
app.include_router(discounts.router)
app.include_router(returns.router)
app.include_router(staff.router)
app.include_router(customers.router)
app.include_router(health.router)

@app.get("/healthz")
def healthz():
    return {"status": "ok", "app": "kadam", "subdomain": "kadam"}

@app.get("/api/metrics/registry")
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
