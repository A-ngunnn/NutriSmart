"""
NutriSmart AI Backend – FastAPI Entry Point

เริ่มต้นด้วย:
    uvicorn main:app --reload --port 8080
"""

import os
from dotenv import load_dotenv

# โหลด Environment Variables ทันทีตั้งแต่เริ่มระบบ
load_dotenv()

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from services.rag_service import load_knowledge
from services.storage_service import initialize_storage
from services import notification_scheduler
from routers import analyze, chat
from routers import dashboard, profile, logs, health_api, notifications, food_search

settings = get_settings()


# ── Lifespan: load knowledge on startup ──────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[START] NutriSmart Backend starting...")
    print(f"[INFO] Loading knowledge base from: {settings.knowledge_dir}")
    count = load_knowledge()
    print(f"[OK] Knowledge base ready ({count} items)")
    print(f"[INFO] Initializing storage at: {settings.storage_db}")
    initialize_storage()
    # seed global food catalog (idempotent)
    from routers.food_search import seed_global_foods
    seeded = seed_global_foods()
    if seeded > 0:
        print(f"[OK] Seeded {seeded} items into global food catalog")
    notification_scheduler.start()
    print("[OK] Notification scheduler started")
    yield
    notification_scheduler.stop()
    print("[STOP] NutriSmart Backend shutting down.")


# ── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="NutriSmart AI Backend",
    description="API สำหรับวิเคราะห์ฉลากโภชนาการและถาม-ตอบด้านโภชนาการ",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – origins configurable via CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_logger = logging.getLogger("nutrismart.main")


def _cors_headers(request: Request) -> dict:
    """Return CORS headers matching the request origin (if allowed).

    Starlette's CORSMiddleware only wraps the router — responses produced by
    @app.exception_handler() escape before the middleware can inject the
    Access-Control-Allow-Origin header, so the browser blocks them with a
    CORS error even though the allowed-origins list is correct.  We add the
    header ourselves here as a safety net.
    """
    origin = request.headers.get("origin", "")
    allowed = settings.cors_origins_list
    if origin in allowed or "*" in allowed:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}
    return {}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    with open("error_log.txt", "a", encoding="utf-8") as f:
        f.write(traceback.format_exc() + "\n\n")
    _logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers(request),
    )

from fastapi.exceptions import RequestValidationError, ResponseValidationError

@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request: Request, exc: ResponseValidationError):
    import traceback
    with open("error_log.txt", "a", encoding="utf-8") as f:
        f.write("RESPONSE VALIDATION ERROR:\n" + str(exc.errors()) + "\n\n")
    return JSONResponse(
        status_code=500,
        content={"detail": "Response validation error", "errors": exc.errors()},
        headers=_cors_headers(request),
    )

# ── Register routers ────────────────────────────────────────────────────────
app.include_router(analyze.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(profile.router)
app.include_router(logs.router)
app.include_router(health_api.router)
app.include_router(notifications.router)
app.include_router(food_search.router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "NutriSmart AI Backend"}


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
