"""
Notifications Router – FastAPI
ดึง / อัปเดต / สร้างการแจ้งเตือนจริงจากฐานข้อมูล PostgreSQL (Supabase)

Endpoints:
  GET    /api/notifications              — ดึงรายการแจ้งเตือนของ user
  PUT    /api/notifications/{id}/read    — อ่านแล้ว (is_read = true)
  DELETE /api/notifications/{id}         — ลบ (soft-dismiss)
  POST   /api/notifications/trigger-summary/weekly  — เทรนเนอร์สรุปสุขภาพรายสัปดาห์ (manual/demo)
  POST   /api/notifications/trigger-summary/monthly — เทรนเนอร์สรุปแนวโน้มรายเดือน (manual/demo)
  POST   /api/notifications/trigger-summary/yearly  — เทรนเนอร์สรุปแนวโน้มรายปี (manual/demo)
  POST   /api/notifications/trigger-reminder        — เทรนเนอร์ตามจิกให้เข้ามาอัปเดตข้อมูล (manual/demo)

หมายเหตุ: ตั้งแต่เพิ่ม services/notification_scheduler.py แล้ว endpoint trigger-* ด้านบนไม่ใช่ทาง
เดียวที่แจ้งเตือนเหล่านี้จะถูกส่งอีกต่อไป — scheduler จะเรียกตรรกะเดียวกัน (จาก
services/trainer_notifications.py) ให้อัตโนมัติตามตารางเวลาในระบบจริง endpoint พวกนี้ที่เหลือไว้
สำหรับให้ทดสอบ/เดโมแจ้งเตือนได้ทันทีโดยไม่ต้องรอตารางเวลา
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import SessionLocal
import models
from services.trainer_notifications import (
    run_weekly_summary, run_monthly_summary, run_yearly_summary, run_daily_reminder,
    run_sodium_good_day,
)
from middleware.auth import get_current_user

logger = logging.getLogger("nutrismart.notifications")

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


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
    line_sent: bool  # True = คิวส่ง LINE ไว้แล้ว (background), False = ไม่มี line_user_id ผูกไว้


class ReminderRequest(BaseModel):
    user_id: Optional[str] = None
    force: bool = False  # True = ส่งเตือนเสมอ แม้ลูกเทรนจะบันทึกข้อมูลวันนี้ไปแล้ว (ใช้ตอนเดโม)


class ReminderResponse(BaseModel):
    sent: bool
    notification_id: Optional[str] = None
    title: str
    body: str


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


# ── Endpoints: CRUD ──────────────────────────────────────────────────────────

NOTIFICATION_MAX_AGE_DAYS = 14  # ของเก่ากว่านี้ไม่มีประโยชน์แล้ว (เช่น "โซเดียมเกินวันนี้" ของ 2 สัปดาห์ก่อน) ไม่ต้องโชว์ปนกับของใหม่


@router.get("", response_model=List[NotificationResponse])
@router.get("/", response_model=List[NotificationResponse], include_in_schema=False)
def list_notifications(user_id: str = Depends(get_current_user)):
    """
    ดึงรายการแจ้งเตือนของ user ที่ไม่เก่าเกิน NOTIFICATION_MAX_AGE_DAYS วัน
    เรียงลำดับ: ยังไม่อ่านขึ้นก่อน → ล่าสุดก่อน

    ของเก่ากว่านั้นไม่ต้องลบจริง (เผื่ออยากดูประวัติย้อนหลังในอนาคต) แค่ไม่โชว์ในลิสต์หลัก
    เพื่อไม่ให้ปนกับของใหม่จนดูรกและเข้าใจผิดว่าเป็นของซ้ำ
    """
    cutoff = (datetime.utcnow() - timedelta(days=NOTIFICATION_MAX_AGE_DAYS)).isoformat()
    with SessionLocal() as db:
        rows = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == user_id,
                models.Notification.is_dismissed == False,  # noqa: E712
                models.Notification.created_at >= cutoff,
            )
            .order_by(
                models.Notification.is_read.asc(),   # False (unread) = 0 → ขึ้นก่อน
                models.Notification.created_at.desc(),
            )
            .all()
        )
        return [_row_to_response(r) for r in rows]


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
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
def dismiss_notification(
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


# ── Endpoints: Period Summaries (manual/demo trigger — see module docstring) ─

@router.post("/trigger-summary/weekly", response_model=TriggerSummaryResponse)
async def trigger_weekly_summary(
    body: TriggerSummaryRequest,
    user_id: str = Depends(get_current_user),
):
    notif = await run_weekly_summary(user_id)
    return TriggerSummaryResponse(inserted=True, notification_id=notif.id, title=notif.title, body=notif.body, line_sent=True)


@router.post("/trigger-summary/monthly", response_model=TriggerSummaryResponse)
async def trigger_monthly_summary(
    body: TriggerSummaryRequest,
    user_id: str = Depends(get_current_user),
):
    notif = await run_monthly_summary(user_id)
    return TriggerSummaryResponse(inserted=True, notification_id=notif.id, title=notif.title, body=notif.body, line_sent=True)


@router.post("/trigger-summary/yearly", response_model=TriggerSummaryResponse)
async def trigger_yearly_summary(
    body: TriggerSummaryRequest,
    user_id: str = Depends(get_current_user),
):
    notif = await run_yearly_summary(user_id)
    return TriggerSummaryResponse(inserted=True, notification_id=notif.id, title=notif.title, body=notif.body, line_sent=True)


# ── Endpoint: Proactive Reminder ("ตามจิก/สะกิดลูกเทรน") ─────────────────────

@router.post("/trigger-reminder", response_model=ReminderResponse)
async def trigger_reminder(
    body: ReminderRequest,
    user_id: str = Depends(get_current_user),
):
    notif = await run_daily_reminder(user_id, force=body.force)
    if notif is None:
        return ReminderResponse(
            sent=False,
            title="ลูกเทรนอัปเดตข้อมูลวันนี้แล้ว",
            body="ไม่ต้องส่งเตือนซ้ำ เทรนเนอร์เห็นว่าลูกเทรนบันทึกข้อมูลวันนี้ไปแล้ว เก่งมาก!",
        )
    return ReminderResponse(sent=True, notification_id=notif.id, title=notif.title, body=notif.body)


@router.post("/trigger-summary/sodium-good-day", response_model=ReminderResponse)
async def trigger_sodium_good_day(user_id: str = Depends(get_current_user)):
    """ทดสอบแจ้งเตือนเชิงชม (โซเดียมวันนี้ต่ำกว่าเกณฑ์) — ของจริงเช็คช่วงค่ำ ปุ่มนี้กดดูผลได้ทันที"""
    notif = await run_sodium_good_day(user_id)
    if notif is None:
        return ReminderResponse(
            sent=False,
            title="ยังส่งไม่ได้ตอนนี้",
            body="วันนี้ยังไม่มีผลสแกน หรือโซเดียมรวมยังเกิน 70% ของเกณฑ์ — ลองสแกนอาหารโซเดียมต่ำดูก่อนนะคะ",
        )
    return ReminderResponse(sent=True, notification_id=notif.id, title=notif.title, body=notif.body)


# ── Endpoint: ทดสอบ Web Push (FCM) ───────────────────────────────────────────

@router.post("/test-push")
async def test_push_notification(user_id: str = Depends(get_current_user)):
    """ส่ง Web Push ทดสอบไปยังทุกอุปกรณ์ที่ user เปิดรับแจ้งเตือนไว้ทันที (ไม่ผ่าน background task)
    เพื่อให้หน้าตั้งค่าแสดงผลลัพธ์ success/fail ได้จริงทันที ต่างจาก send_push_if_available ที่ fire-and-forget เสมอ"""
    from services.storage_service import get_device_tokens
    from services.fcm_service import send_push_notification
    from firebase_admin import messaging as fcm_messaging

    tokens = get_device_tokens(user_id)
    if not tokens:
        raise HTTPException(status_code=400, detail="ยังไม่ได้เปิดรับการแจ้งเตือนบนอุปกรณ์นี้ กรุณากดเปิดสิทธิ์ก่อน")

    sent_count = 0
    for token in tokens:
        try:
            ok = send_push_notification(
                fcm_token=token,
                title="ทดสอบการแจ้งเตือน ✅",
                body="เชื่อมต่อสำเร็จแล้ว! ต่อจากนี้คุณจะได้รับการแจ้งเตือนจาก NutriSmart บนอุปกรณ์นี้ด้วยนะคะ",
                emoji="✅",
                category="system",
                priority="low",
            )
            if ok:
                sent_count += 1
        except fcm_messaging.UnregisteredError:
            continue  # token หมดอายุ — ปล่อยให้รอบ push จริงครั้งต่อไปลบออก ไม่ต้อง fail การทดสอบนี้

    if sent_count == 0:
        raise HTTPException(
            status_code=502,
            detail="ส่งไม่สำเร็จ — ตรวจสอบว่าตั้งค่า Firebase ฝั่ง backend ถูกต้อง (FIREBASE_SERVICE_ACCOUNT_*) และลองเปิดสิทธิ์ใหม่อีกครั้ง",
        )
    return {"success": True, "devicesNotified": sent_count}
