from fastapi import Request, HTTPException
import httpx
from config import get_settings
import logging

_logger = logging.getLogger("nutrismart.auth")

settings = get_settings()

# Supabase Auth REST endpoint — accepts sb_publishable_… keys as a plain header value,
# bypassing supabase-py's JWT-format validation that rejects the new key format.
_SUPABASE_USER_URL = f"{settings.supabase_url}/auth/v1/user"


async def get_current_user(request: Request) -> str:
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = auth_header.split(" ", 1)[1]

    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="Supabase client not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _SUPABASE_USER_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
            )

        # GoTrue uses 401 for missing tokens and 403 for bad/expired JWT signatures.
        if resp.status_code in (401, 403):
            body = resp.json() if resp.content else {}
            detail = body.get("msg") or body.get("error") or "Invalid or expired token"
            raise HTTPException(status_code=401, detail=detail)
        if not resp.is_success:
            raise HTTPException(
                status_code=401,
                detail=f"Authentication failed (Supabase {resp.status_code})",
            )

        user_data = resp.json()
        user_id = user_data.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user id")
        return user_id

    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("Authentication failed: %s", str(e)[:120])
        raise HTTPException(status_code=401, detail="Authentication failed")
