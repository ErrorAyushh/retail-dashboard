"""
Authentication endpoints router.
Handles Google ID token login and user session info.
"""
import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Depends, status

from backend.config import ENV, ALLOWED_DOMAIN
from backend.auth import (
    verify_google_token,
    validate_user_access,
    create_access_token,
    get_current_user
)

logger = logging.getLogger("kadam.auth_router")

router = APIRouter(prefix="/api/auth", tags=["auth"])

class GoogleLoginRequest(BaseModel):
    credential: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

@router.post("/google", response_model=TokenResponse)
def login_with_google(payload: GoogleLoginRequest):
    """
    Exchanges Google OAuth ID token for a signed Kadam JWT.
    Restricts access strictly to @neemans.com accounts and ALLOWED_EMAILS.
    """
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google credential token."
        )

    # Allow mock login in development / test environments if token begins with mock:
    if credential.startswith("mock:") and ENV != "production":
        email = credential.replace("mock:", "").strip().lower()
        name = email.split("@")[0].replace(".", " ").title()
        picture = ""
    else:
        id_info = verify_google_token(credential)
        email = id_info.get("email", "").strip().lower()
        name = id_info.get("name", email.split("@")[0].title())
        picture = id_info.get("picture", "")

    # Validate company domain and allowlist
    validate_user_access(email)

    # Issue signed JWT
    token_claims = {
        "sub": email,
        "email": email,
        "name": name,
        "picture": picture,
        "role": "Retail Ops"
    }
    access_token = create_access_token(token_claims)

    logger.info(f"User logged in successfully: {email}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": token_claims
    }

@router.get("/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated user's profile and permissions."""
    return {"user": user}
