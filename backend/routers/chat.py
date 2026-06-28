# backend/routers/chat.py

import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.ai_service import chat
from services.storage_service import check_and_log_api_usage
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["Chat"])
_logger = logging.getLogger("nutrismart.chat")


# ── Models ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[ChatMessage]] = None
    user_profile: Optional[Dict[str, Any]] = None  # 🌟 [เพิ่มจุดนี้] เพื่อให้รองรับ Profile ที่หน้าบ้านส่งมานาย!


class ChatResponse(BaseModel):
    reply: str


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def nutri_chat(body: ChatRequest, user_id: str = Depends(get_current_user)):
    """Send a message to NutriSmart AI chatbot (RAG-enhanced)."""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="ข้อความต้องไม่เป็นค่าว่าง")

    # เช็ก Rate Limit 20 ข้อความต่อวัน (คุมต้นทุน AI ช่วงที่ยังใช้ free tier อยู่)
    if not check_and_log_api_usage(user_id, "/api/chat", max_limit=20):
        raise HTTPException(status_code=429, detail="คุณใช้งานโควตาแชทครบ 20 ข้อความของวันนี้แล้วค่ะ")

    try:
        history_dicts = None
        if body.history:
            history_dicts = [{"role": m.role, "content": m.content} for m in body.history]

        # 🌟 [แก้ไข] ส่งพ่วง user_profile เข้าไปในฟังก์ชันระดับ Service ด้วย
        reply = await chat(body.message, chat_history=history_dicts, user_profile=body.user_profile)
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception:
        _logger.exception("Chat reply failed")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการตอบ กรุณาลองใหม่อีกครั้ง")