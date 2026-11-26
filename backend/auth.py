"""
Authentication and Authorization module for Kadam API.
Implements Google OAuth verification and signed JWT Bearer authentication.
"""
import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone

from fastapi import Request, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from backend.config import (
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    ALLOWED_DOMAIN,
    ALLOWED_EMAILS,
    GOOGLE_CLIENT_ID,
    ENV
)

logger = logging.getLogger("kadam.auth")

security_bearer = HTTPBearer(auto_error=False)

def get_jwt_secret() -> str:
    """Returns configured JWT secret or dev test secret if in development."""
    if JWT_SECRET:
        return JWT_SECRET
    if ENV != "production":
        return "development_test_jwt_secret_key_32_chars_minimum"
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Server authentication secret (JWT_SECRET) is not configured."
    )

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token."""
    secret = get_jwt_secret()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, secret, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a signed JWT token."""
    secret = get_jwt_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: token expired or invalid."
        )

def verify_google_token(credential: str) -> Dict[str, Any]:
    """
    Verifies a Google OAuth ID token from the frontend Google Sign-In prompt.
    Returns the decoded token claims (email, name, picture).
    """
    try:
        # If GOOGLE_CLIENT_ID is set, verify against it; otherwise verify signature
        request = google_requests.Request()
        client_id = GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None
        id_info = id_token.verify_oauth2_token(credential, request, client_id)
        return id_info
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authentication token."
        )

def validate_user_access(email: str) -> None:
    """
    Validates that the user belongs to @neemans.com and matches ALLOWED_EMAILS if set.
    """
    email_clean = (email or "").strip().lower()
    if not email_clean:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User email is required."
        )

    # Check company domain
    domain = email_clean.split("@")[-1] if "@" in email_clean else ""
    if domain != ALLOWED_DOMAIN:
        logger.warning(f"Rejected login for non-company email domain: {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access restricted to @{ALLOWED_DOMAIN} accounts."
        )

    # Check optional allowlist
    if ALLOWED_EMAILS and email_clean not in ALLOWED_EMAILS:
        logger.warning(f"Rejected login: email {email_clean} not in ALLOWED_EMAILS")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: your email is not on the authorized user list."
        )

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> Dict[str, Any]:
    """
    FastAPI dependency required on all protected /api/* data routes.
    Extracts and validates Bearer token, enforcing valid domain and allowlist.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token."
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    email = payload.get("email") or payload.get("sub")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user email."
        )

    validate_user_access(email)
    return payload
