"""
NutriSmart AI Backend – FastAPI Entry Point

เริ่มต้นด้วย:
    uvicorn main:app --reload --port 8080
"""

import os
from dotenv import load_dotenv

# โหลด Environment Variables ทันทีตั้งแต่เริ่มระบบ
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from services.rag_service import load_knowledge
from services.storage_service import initialize_storage
from routers import analyze, chat
from routers import dashboard, profile, logs, health_api, notifications

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
    yield
    print("[STOP] NutriSmart Backend shutting down.")


# ── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="NutriSmart AI Backend",
    description="API สำหรับวิเคราะห์ฉลากโภชนาการและถาม-ตอบด้านโภชนาการ",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow frontend dev server
origins = [
    "https://nutri-smart-gray.vercel.app",
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────────────────
app.include_router(analyze.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(profile.router)
app.include_router(logs.router)
app.include_router(health_api.router)
app.include_router(notifications.router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "NutriSmart AI Backend"}


@app.get("/api/test-ai")
async def test_ai_keys():
    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    
    return {
        "status": "ok",
        "GEMINI_API_KEY_FOUND": bool(gemini_key),
        "GEMINI_API_KEY_PREVIEW": f"{gemini_key[:4]}..." if gemini_key and len(gemini_key) > 4 else "Not Configured",
        "OPENROUTER_API_KEY_FOUND": bool(openrouter_key),
        "OPENROUTER_API_KEY_PREVIEW": f"{openrouter_key[:4]}..." if openrouter_key and len(openrouter_key) > 4 else "Not Configured"
    }

# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
