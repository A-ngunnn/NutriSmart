"""
Router: /api/chat – NutriChat RAG-enhanced conversation endpoint.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_service import chat

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── Models ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[ChatMessage]] = None


class ChatResponse(BaseModel):
    reply: str


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def nutri_chat(body: ChatRequest):
    """Send a message to NutriSmart AI chatbot (RAG-enhanced)."""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="ข้อความต้องไม่เป็นค่าว่าง")

    try:
        history_dicts = None
        if body.history:
            history_dicts = [{"role": m.role, "content": m.content} for m in body.history]

        reply = await chat(body.message, chat_history=history_dicts)
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการตอบ: {str(e)}")
