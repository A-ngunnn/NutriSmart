from fastapi import Request, HTTPException
from supabase import create_client, Client
from config import get_settings
import logging

_logger = logging.getLogger("nutrismart.auth")

settings = get_settings()

try:
    supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
except Exception:
    supabase = None

def get_current_user(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        # Fallback for development/testing if no token provided but only if explicitly allowed, 
        # but for SEC-001 we must reject missing tokens.
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
        
    token = auth_header.split(" ")[1]
    
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not configured")
        
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except HTTPException:
        raise  # re-raise HTTPException ตรงๆ ไม่ห่อใหม่
    except Exception as e:
        _logger.warning("Authentication failed for token: %s", str(e)[:120])
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
