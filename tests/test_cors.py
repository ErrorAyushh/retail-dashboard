from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_cors_allowed_localhost():
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }
    res = client.options("/health", headers=headers)
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"

def test_cors_rejected_foreign_origin():
    headers = {
        "Origin": "http://evil-attacker.com",
        "Access-Control-Request-Method": "GET"
    }
    res = client.options("/health", headers=headers)
    allow_origin = res.headers.get("access-control-allow-origin")
    assert allow_origin != "http://evil-attacker.com"
    assert allow_origin != "*"
