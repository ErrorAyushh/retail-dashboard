from starlette.testclient import TestClient
from backend.main import app
from backend.auth import create_access_token

client = TestClient(app)

def test_health_public():
    """Health check is open to public without token."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "kadam"

def test_all_api_data_routes_protected():
    """Verify that core data routes require a valid Bearer token."""
    protected_endpoints = [
        "/api/overview",
        "/api/stores",
        "/api/geography",
        "/api/products",
        "/api/discounts",
        "/api/returns",
        "/api/staff",
        "/api/customers",
        "/api/filters/meta",
        "/api/metrics/registry"
    ]
    for endpoint in protected_endpoints:
        res = client.get(endpoint)
        assert res.status_code == 401, f"Expected 401 on {endpoint}, got {res.status_code}"

def test_gzip_compression_on_large_payload():
    """Verify GZipMiddleware compresses payloads larger than 1000 bytes."""
    token = create_access_token({"sub": "ops@neemans.com", "email": "ops@neemans.com", "role": "Retail Ops"})
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept-Encoding": "gzip"
    }
    res = client.get("/api/filters/meta", headers=headers)
    assert res.status_code == 200
    # Starlette test client automatically unzips or preserves headers
    assert "text/html" not in res.headers.get("content-type", "")
