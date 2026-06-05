"""
NutriSmart AI Backend – FastAPI Entry Point

เริ่มต้นด้วย:
    uvicorn main:app --reload --port 8080
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from services.rag_service import load_knowledge
from routers import analyze, chat

settings = get_settings()


# ── Lifespan: load knowledge on startup ──────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[START] NutriSmart Backend starting...")
    print(f"[INFO] Loading knowledge base from: {settings.knowledge_dir}")
    count = load_knowledge()
    print(f"[OK] Knowledge base ready ({count} items)")
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────────────────
app.include_router(analyze.router)
app.include_router(chat.router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "NutriSmart AI Backend"}


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
