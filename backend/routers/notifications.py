"""
Notifications Router – FastAPI
ดึง / อัปเดต / สร้างการแจ้งเตือนจริงจากฐานข้อมูล PostgreSQL (Supabase)

Endpoints:
  GET    /api/notifications          — ดึงรายการแจ้งเตือนของ user
  PUT    /api/notifications/{id}/read — อ่านแล้ว (is_read = true)
  DELETE /api/notifications/{id}     — ลบ (soft-dismiss)
  POST   /api/notifications/trigger-summary — เดโม: ให้ MedGemma สรุปสุขภาพสัปดาห์
"""

import uuid
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from pydantic import BaseModel

from config import get_settings
from database import SessionLocal
import models
from services.line_service import send_line_if_available
from services.storage_service import insert_notification
from services.ai_service import call_medgemma
from middleware.auth import get_current_user

settings = get_settings()
logger = logging.getLogger("nutrismart.notifications")

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

# ── Constants ────────────────────────────────────────────────────────────────
SODIUM_DAILY_LIMIT_MG = 2_000.0

DEFAULT_USER_ID = "default"


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    category: str          # daily | goal | ai | system
    priority: str          # low | medium | high
    title: str
    body: str
    emoji: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


class TriggerSummaryRequest(BaseModel):
    user_id: Optional[str] = None


class TriggerSummaryResponse(BaseModel):
    inserted: bool
    notification_id: str
    title: str
    body: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _today_str() -> str:
    return date.today().isoformat()


def _row_to_response(row: models.Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(row.id),
        user_id=str(row.user_id),
        category=str(row.category),
        priority=str(row.priority),
        title=str(row.title),
        body=str(row.body),
        emoji=str(row.emoji),
        is_read=bool(row.is_read),
        created_at=str(row.created_at),
    )





# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[NotificationResponse])
async def list_notifications(user_id: str = Depends(get_current_user)):
    """
    ดึงรายการแจ้งเตือนทั้งหมดของ user
    เรียงลำดับ: ยังไม่อ่านขึ้นก่อน → ล่าสุดก่อน
    """
    with SessionLocal() as db:
        rows = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == user_id,
                models.Notification.is_dismissed == False,  # noqa: E712
            )
            .order_by(
                models.Notification.is_read.asc(),   # False (unread) = 0 → ขึ้นก่อน
                models.Notification.created_at.desc(),
            )
            .all()
        )
        return [_row_to_response(r) for r in rows]


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: str,
    user_id: str = Depends(get_current_user),
):
    """อัปเดต is_read = true"""
    with SessionLocal() as db:
        notif = (
            db.query(models.Notification)
            .filter(
                models.Notification.id == notification_id,
                models.Notification.user_id == user_id,
            )
            .first()
        )
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found")
        notif.is_read = True
        notif.read_at = datetime.utcnow().isoformat()
        db.commit()
        db.refresh(notif)
        return _row_to_response(notif)


@router.delete("/{notification_id}")
async def dismiss_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user),
):
    """Soft-delete: ตั้ง is_dismissed = true (ไม่ลบจริง)"""
    with SessionLocal() as db:
        notif = (
            db.query(models.Notification)
            .filter(
                models.Notification.id == notification_id,
                models.Notification.user_id == user_id,
            )
            .first()
        )
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found")
        notif.is_dismissed = True
        db.commit()
        return {"success": True}


@router.post("/trigger-summary", response_model=TriggerSummaryResponse)
async def trigger_weekly_summary(
    body: TriggerSummaryRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    เดโมสำหรับการนำเสนอ:
    - ดึง Food Logs ย้อนหลัง 7 วัน
    - ส่งให้ MedGemma สรุปสุขภาพเป็นข้อความสวยงาม
    - INSERT ลงตาราง notifications จริง
    """
    today = date.today()
    start_date = (today - timedelta(days=6)).isoformat()
    end_date = today.isoformat()

    # ── ดึงข้อมูลอาหาร 7 วัน ──────────────────────────────────────────────
    with SessionLocal() as db:
        food_rows = (
            db.query(models.FoodLog)
            .filter(
                models.FoodLog.user_id == user_id,
                models.FoodLog.date >= start_date,
                models.FoodLog.date <= end_date,
            )
            .order_by(models.FoodLog.date.desc())
            .all()
        )

    if not food_rows:
        # ยังไม่มีข้อมูล → INSERT แจ้งเตือนแนะนำให้บันทึกอาหาร
        notif = insert_notification(
            user_id=user_id,
            category="ai",
            priority="medium",
            title="ยังไม่มีข้อมูลอาหาร 7 วันที่ผ่านมา",
            body="ลองบันทึกอาหารทุกมื้อเพื่อให้ AI สรุปรายงานสุขภาพให้คุณได้นะคะ 🥗",
            emoji="📊",
        )
        # ── ส่ง LINE Push ด้วย (Background) ──────────────────────────────────
        background_tasks.add_task(
            send_line_if_available,
            user_id=user_id,
            title="ยังไม่มีข้อมูลอาหาร 7 วันที่ผ่านมา",
            body="ลองบันทึกอาหารทุกมื้อเพื่อให้ AI สรุปรายงานสุขภาพให้คุณได้นะคะ 🥗",
            emoji="📊",
            category="ai",
            priority="medium",
        )
        return TriggerSummaryResponse(
            inserted=True,
            notification_id=notif.id,
            title=notif.title,
            body=notif.body,
        )

    # ── สรุปสถิติรายวัน ────────────────────────────────────────────────────
    day_stats: dict[str, dict] = {}
    for row in food_rows:
        d = str(row.date)
        if d not in day_stats:
            day_stats[d] = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
        day_stats[d]["calories"] += float(row.calories or 0)
        day_stats[d]["protein"] += float(row.protein or 0)
        day_stats[d]["carbs"] += float(row.carbs or 0)
        day_stats[d]["fat"] += float(row.fat or 0)

    n_days = len(day_stats)
    avg_cal = sum(v["calories"] for v in day_stats.values()) / n_days
    avg_pro = sum(v["protein"] for v in day_stats.values()) / n_days
    avg_carb = sum(v["carbs"] for v in day_stats.values()) / n_days
    avg_fat = sum(v["fat"] for v in day_stats.values()) / n_days

    # ── สร้าง Prompt สำหรับ MedGemma ──────────────────────────────────────
    stats_text = "\n".join(
        f"  {d}: แคลอรี {v['calories']:.0f} kcal | โปรตีน {v['protein']:.1f}g | คาร์บ {v['carbs']:.1f}g | ไขมัน {v['fat']:.1f}g"
        for d, v in sorted(day_stats.items())
    )
    prompt = f"""คุณคือ NutriSmart AI ผู้เชี่ยวชาญด้านโภชนาการ
กรุณาอ่านข้อมูลการบริโภคอาหารใน 7 วันที่ผ่านมาของผู้ใช้แล้วเขียนสรุปสุขภาพเป็นภาษาไทย

ข้อมูลสถิติรายวัน:
{stats_text}

สรุป (เฉลี่ยต่อวัน):
  แคลอรี {avg_cal:.0f} kcal | โปรตีน {avg_pro:.1f}g | คาร์บ {avg_carb:.1f}g | ไขมัน {avg_fat:.1f}g

ค่าอ้างอิง Thai RDI: แคลอรี 2,000 kcal | โปรตีน 50g | คาร์บ 300g | ไขมัน 65g

กรุณาเขียนสรุปสุขภาพ 2-3 ประโยค สั้นกระชับ เข้าใจง่าย มีคำแนะนำเชิงบวก และลงท้ายด้วยประโยคกำลังใจ
ห้ามใส่หัวข้อหรือสัญลักษณ์ Markdown ตอบเป็นข้อความธรรมดาเท่านั้น"""

    # ── เรียก MedGemma ────────────────────────────────────────────────────
    try:
        ai_summary = await call_medgemma(prompt)
        # ตัดให้ไม่ยาวเกินไป
        ai_summary = ai_summary.strip().replace("**", "").replace("##", "").strip()
        if len(ai_summary) > 300:
            ai_summary = ai_summary[:297] + "..."
    except HTTPException:
        ai_summary = (
            f"สัปดาห์นี้คุณทานแคลอรีเฉลี่ย {avg_cal:.0f} kcal/วัน "
            f"โปรตีน {avg_pro:.0f}g และไขมัน {avg_fat:.0f}g ต่อวัน "
            "ยังคงรักษาพฤติกรรมการกินที่ดีต่อไปนะคะ 💪"
        )

    notif = insert_notification(
        user_id=user_id,
        category="ai",
        priority="medium",
        title="รายงานสุขภาพประจำสัปดาห์ 📊",
        body=ai_summary,
        emoji="📊",
    )

    # ── ส่ง LINE Push ควบคู่กับการบันทึกในเว็บ (Background) ────────────────
    background_tasks.add_task(
        send_line_if_available,
        user_id=user_id,
        title="สรุปสุขภาพประจำสัปดาห์จาก AI ✨",
        body=ai_summary,
        emoji="📊",
        category="ai",
        priority="medium",
    )

    return TriggerSummaryResponse(
        inserted=True,
        notification_id=notif.id,
        title=notif.title,
        body=notif.body,
    )
