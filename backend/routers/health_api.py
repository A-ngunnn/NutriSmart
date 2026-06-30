import logging
from typing import List, Optional

from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel

from services.storage_service import get_health_summary, get_service_status, check_and_log_api_usage
from services.trainer_notifications import generate_ai_health_insights
from middleware.auth import get_current_user

_logger = logging.getLogger("nutrismart.health_api")

router = APIRouter(prefix="/api/health", tags=["Health"])


class ServiceStatusResponse(BaseModel):
    status: str
    service: str
    version: str
    database: str
    model: str
    ai_api_key_set: bool
    database_error: Optional[str] = None


class HealthSummaryResponse(BaseModel):
    profile: dict
    tdee: int
    last_7_days: list
    avg_calories: int
    avg_scan_score: int
    scan_count: int
    macro_totals: dict
    scan_history: list
    monthly_data: list
    monthly_stats: dict
    yearly_data: list
    yearly_stats: dict


@router.get("/status", response_model=ServiceStatusResponse)
def health_status(user_id: str = Depends(get_current_user)):
    # `def` ธรรมดา (ไม่ใช่ async def) โดยตั้งใจ — get_service_status() เป็น sync/blocking SQLAlchemy
    # call ถ้า async def แล้วเรียก sync ตรงๆ จะบล็อก event loop ทั้งตัว ทำให้ request อื่นที่เข้ามา
    # พร้อมกันต้องรอเรียงคิว Starlette จะรัน def ธรรมดาใน thread pool แยกให้อัตโนมัติ
    return get_service_status()


@router.get("/summary", response_model=HealthSummaryResponse)
def health_summary(user_id: str = Depends(get_current_user)):
    # เหตุผลเดียวกัน — get_health_summary() ใช้เวลาหลายวินาที (หลาย query ไป Supabase) ถ้าเป็น
    # async def จะบล็อก event loop ทั้งเซิร์ฟเวอร์ตลอดช่วงนั้น ทำให้ request อื่นๆ (เช่น Promise.all
    # จาก fetchUserData ฝั่ง frontend) ดีเลย์/timeout ไปด้วย แม้จะไม่เกี่ยวกับ endpoint นี้เลยก็ตาม
    return get_health_summary(user_id)


class HealthInsightsResponse(BaseModel):
    insights: List[str]


@router.get("/insights", response_model=HealthInsightsResponse)
async def health_insights(
    period: str = Query("weekly", pattern="^(weekly|monthly|yearly)$"),
    user_id: str = Depends(get_current_user),
):
    """วิเคราะห์ insight สุขภาพด้วย AI จริง (MedGemma + RAG) ตามบริบทของ user คนนั้น
    (โรคประจำตัว, สัดส่วนมาโคร, แนวโน้ม) ต่างจาก insight แบบ template ที่คำนวณฝั่ง frontend —
    เรียกเมื่อผู้ใช้กดปุ่ม "วิเคราะห์ด้วย AI" เท่านั้น ไม่ auto-call ทุกครั้งที่เปิดหน้าเพื่อประหยัดโควตา AI"""
    if not check_and_log_api_usage(user_id, "/api/health/insights", max_limit=10):
        raise HTTPException(status_code=429, detail="คุณใช้งานโควตาวิเคราะห์ด้วย AI ครบ 10 ครั้งของวันนี้แล้วค่ะ")
    try:
        insights = await generate_ai_health_insights(user_id, period)
        return HealthInsightsResponse(insights=insights)
    except Exception:
        _logger.exception("AI health insights failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="วิเคราะห์ด้วย AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
