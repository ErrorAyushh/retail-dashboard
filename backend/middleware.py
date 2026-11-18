"""
Middleware and security dependencies for Kadam API.
Includes PII access validation, structured logging with PII scrubbing, and timing.
"""
import time
import logging
import re
from fastapi import Request, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("kadam.api")

# Header keys
PII_HEADER = APIKeyHeader(name="X-Can-View-PII", auto_error=False)
USER_ROLE_HEADER = APIKeyHeader(name="X-User-Role", auto_error=False)

def check_can_view_pii(request: Request) -> bool:
    """
    Determines if current caller has permission to view PII.
    Accepts X-Can-View-PII: true, X-User-Role: admin / finance / auditor,
    or can_view_pii=true in query params (for dev convenience).
    """
    header_flag = request.headers.get("X-Can-View-PII", "").strip().lower()
    if header_flag in ["1", "true", "yes"]:
        return True
    
    role = request.headers.get("X-User-Role", "").strip().lower()
    if role in ["admin", "superadmin", "finance", "compliance"]:
        return True

    param_flag = request.query_params.get("can_view_pii", "").strip().lower()
    if param_flag in ["1", "true", "yes"]:
        return True

    return False

# PII masking helpers
def mask_mobile(mobile: str) -> str:
    """Masks mobile number: 9876543210 -> XXXXXX3210"""
    if not mobile:
        return "Unknown"
    cleaned = re.sub(r"\D", "", str(mobile))
    if len(cleaned) >= 4:
        return "X" * (len(cleaned) - 4) + cleaned[-4:]
    return "XXXX"

def mask_name(name: str) -> str:
    """Masks customer name to initials: 'Rahul Sharma' -> 'R. S.'"""
    if not name:
        return "Unknown"
    parts = name.strip().split()
    if len(parts) >= 2:
        return f"{parts[0][0].upper()}. {parts[-1][0].upper()}."
    elif len(parts) == 1:
        return f"{parts[0][0].upper()}."
    return "Unknown"

def mask_gstin(gstin: str) -> str:
    """Masks GST number: 27AAAAA0000A1Z5 -> 27XXXXXXXXX1Z5"""
    if not gstin:
        return "—"
    s = str(gstin).strip()
    if len(s) >= 6:
        return s[:2] + ("X" * (len(s) - 5)) + s[-3:]
    return "XXXXXXXXXX"

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Guard: scrub any raw mobile or PII from logged query params
        safe_url = re.sub(r"(mobile|customer_mobile|gst)=\w+", r"\1=[REDACTED]", str(request.url))
        
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
            logger.info(f"{request.method} {safe_url} - Status: {response.status_code} in {process_time:.1f}ms")
            return response
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger.error(f"{request.method} {safe_url} failed after {process_time:.1f}ms: {str(e)}")
            raise
