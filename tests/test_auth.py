import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.auth import create_access_token, decode_access_token, validate_user_access
from fastapi import HTTPException

client = TestClient(app)

def test_token_creation_and_decoding():
    claims = {"sub": "ops@neemans.com", "role": "Retail Ops"}
    token = create_access_token(claims)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "ops@neemans.com"
    assert decoded["role"] == "Retail Ops"

def test_unauthenticated_request_rejected():
    response = client.get("/api/overview")
    assert response.status_code == 401
    assert "detail" in response.json()

def test_invalid_token_rejected():
    headers = {"Authorization": "Bearer invalid_gibberish_token"}
    response = client.get("/api/overview", headers=headers)
    assert response.status_code == 401

def test_login_non_company_domain_rejected():
    response = client.post("/api/auth/google", json={"credential": "mock:hacker@gmail.com"})
    assert response.status_code == 403
    assert "@neemans.com" in response.json()["detail"]

def test_login_valid_company_email():
    response = client.post("/api/auth/google", json={"credential": "mock:ops@neemans.com"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "ops@neemans.com"

    # Use the token to access a protected route
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "ops@neemans.com"
