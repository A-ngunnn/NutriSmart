# backend/routers/chat.py

import logging
from datetime import date
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.ai_service import chat
from services.storage_service import (
    check_and_log_api_usage, get_profile, get_food_entries, get_water_entries, _calc_tdee,
)
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

        # เดิมเอา user_profile จากฝั่ง frontend มาตรงๆ ซึ่งมีแค่ชื่อ/น้ำหนัก/ส่วนสูง/อายุ/เป้าหมาย
        # TDEE คงที่ — ไม่มีข้อมูล "วันนี้กินไปแล้วเท่าไหร่" หรือโรคประจำตัว ทำให้แชทบอทตอบแบบทั่วไป
        # ไม่รู้บริบทจริงของผู้ใช้คนนั้น ตอนนี้ดึงข้อมูลจริงจาก DB มาเสริม (เชื่อถือได้กว่าข้อมูลจาก
        # client ด้วย เพราะดึงจากฐานข้อมูลตรง ไม่ใช่ state ฝั่ง frontend ที่อาจค้าง/ไม่ตรงปัจจุบัน)
        merged_profile: Dict[str, Any] = dict(body.user_profile or {})
        try:
            today = date.today().isoformat()
            profile = get_profile(user_id)
            food_today = get_food_entries(user_id, start_date=today, end_date=today)
            water_today = get_water_entries(user_id, start_date=today, end_date=today)

            merged_profile.update({
                "weight": profile.get("weight") or merged_profile.get("weight"),
                "height": profile.get("height") or merged_profile.get("height"),
                "age": profile.get("age") or merged_profile.get("age"),
                "gender": profile.get("gender") or merged_profile.get("gender"),
                "chronic_disease": profile.get("chronic_disease") or "",
                "goal_calories": _calc_tdee(profile) or merged_profile.get("goal_calories"),
                "calories_eaten_today": round(sum(float(e["calories"]) for e in food_today)),
                "protein_eaten_today": round(sum(float(e["protein"]) for e in food_today)),
                "carbs_eaten_today": round(sum(float(e["carbs"]) for e in food_today)),
                "fat_eaten_today": round(sum(float(e["fat"]) for e in food_today)),
                "water_ml_today": round(sum(float(w["amount"]) for w in water_today)),
                "meals_logged_today": len(food_today),
            })
        except Exception:
            _logger.warning("Failed to enrich chat context with live user data (non-fatal)", exc_info=True)

        reply = await chat(body.message, chat_history=history_dicts, user_profile=merged_profile)
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception:
        _logger.exception("Chat reply failed")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการตอบ กรุณาลองใหม่อีกครั้ง")