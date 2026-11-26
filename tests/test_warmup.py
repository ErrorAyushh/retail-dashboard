from starlette.testclient import TestClient
from backend.main import app
from backend.auth import create_access_token

client = TestClient(app)

def test_warmup_requires_post():
    """GET on /api/warmup returns 405 Method Not Allowed."""
    res = client.get("/api/warmup")
    assert res.status_code == 405

def test_warmup_unset_secret_returns_503(monkeypatch):
    """When WARMUP_SECRET is unset, warm-up returns 503 Service Unavailable."""
    import backend.routers.warmup as warmup_module
    monkeypatch.setattr(warmup_module, "WARMUP_SECRET", None)

    headers = {"X-Warmup-Secret": "any_secret"}
    res = client.post("/api/warmup", headers=headers)
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()

def test_warmup_invalid_secret_rejected(monkeypatch):
    """Incorrect secret header returns 403 Forbidden."""
    import backend.routers.warmup as warmup_module
    monkeypatch.setattr(warmup_module, "WARMUP_SECRET", "correct_warmup_secret_val")

    headers = {"X-Warmup-Secret": "invalid_wrong_secret"}
    res = client.post("/api/warmup", headers=headers)
    assert res.status_code == 403

def test_warmup_with_valid_secret(monkeypatch):
    """Valid secret warms cache, fills keys, and returns ok_count and fail_count."""
    import backend.routers.warmup as warmup_module
    monkeypatch.setattr(warmup_module, "WARMUP_SECRET", "correct_warmup_secret_val")

    headers = {"X-Warmup-Secret": "correct_warmup_secret_val"}
    res = client.post("/api/warmup", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "warmup_completed"
    assert data["ok_count"] > 0
    assert data["fail_count"] == 0

    # Verify that a warmed endpoint returns X-Cache: HIT
    token = create_access_token({"sub": "ops@neemans.com", "role": "Retail Ops"})
    auth_headers = {"Authorization": f"Bearer {token}"}
    cached_res = client.get("/api/overview", headers=auth_headers)
    assert cached_res.status_code == 200
    assert cached_res.headers.get("X-Cache") == "HIT"
