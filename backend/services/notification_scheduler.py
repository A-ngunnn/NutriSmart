"""
Notification Scheduler – in-process background loop (no external cron needed).

ปัญหาเดิม: routers/notifications.py มี endpoint trigger-summary/* และ trigger-reminder ที่เจน
แจ้งเตือนจริงจากข้อมูลจริง แต่ "ไม่มีอะไรเรียกมันอัตโนมัติ" — ต้องมีคนกด/ยิง POST เองเท่านั้น
ทำให้บน production ลูกเทรนจะไม่เคยได้รับแจ้งเตือนเหล่านี้เลยถ้าไม่มี cron ภายนอก

วิธีแก้: รัน asyncio task เดียวกับ FastAPI process เอง (เริ่มจาก main.py lifespan) วนเช็คทุก
CHECK_INTERVAL_SECONDS แล้วพิจารณาส่งแจ้งเตือนให้ทุก user ตามเงื่อนไข:
  - Daily reminder  : หลัง REMINDER_HOUR ของวัน ถ้ายังไม่บันทึกอาหาร/น้ำวันนี้ → ส่ง (ครั้งเดียว/วัน)
  - Weekly summary  : ทุกวันจันทร์ → สรุป AI 7 วันล่าสุด (ครั้งเดียว/สัปดาห์)
  - Monthly summary : วันที่ 1 ของเดือน → สรุป AI รายเดือน (ครั้งเดียว/เดือน)
  - Yearly summary  : วันที่ 1 มกราคม → สรุป AI รายปี (ครั้งเดียว/ปี)

กันส่งซ้ำในรอบเดียวกันด้วยการเช็ค notifications ล่าสุดที่ title ตรงกันของ user นั้นว่าส่งไปแล้ว
ตั้งแต่ "วันเริ่มต้นของรอบปัจจุบัน" หรือยัง (ไม่ต้องเพิ่มตาราง/คอลัมน์ใหม่)
"""

import asyncio
import logging
from datetime import date, datetime, timedelta

from database import SessionLocal
import models
from services.trainer_notifications import (
    run_weekly_summary, run_monthly_summary, run_yearly_summary, run_daily_reminder,
    run_daily_goal_recap, run_streak_check, run_sodium_good_day, _current_logging_streak,
    WEEKLY_TITLE, MONTHLY_TITLE, YEARLY_TITLE, REMINDER_TITLE, GOAL_RECAP_TITLE,
    SODIUM_GOOD_DAY_TITLE, STREAK_MILESTONES,
)

logger = logging.getLogger("nutrismart.scheduler")

CHECK_INTERVAL_SECONDS = 30 * 60  # ตรวจทุก 30 นาที
REMINDER_HOUR = 19  # ส่งตามจิกตอน 19:00 (เวลาเซิร์ฟเวอร์) ถ้ายังไม่บันทึกอะไรวันนี้
GOAL_RECAP_HOUR = 21  # ส่งสรุปเชิงบวกตอน 21:00 — รอให้ใกล้สิ้นวันก่อน ไม่งั้นอาจชมเร็วเกินไปแล้วมื้อหลังกินเกิน

_task: "asyncio.Task | None" = None


def _all_user_ids() -> list[str]:
    # profiles.id เป็น uuid จริงในฐานข้อมูล (แม้ model จะประกาศเป็น String) — psycopg2 จะแปลงค่า
    # ที่อ่านได้เป็น uuid.UUID object โดยอัตโนมัติ ถ้าไม่ str() ไว้ตรงนี้ ตอนเอาไปเทียบกับคอลัมน์
    # notifications.user_id (เป็น text จริง) จะกลายเป็น "operator does not exist: text = uuid"
    with SessionLocal() as db:
        return [str(row[0]) for row in db.query(models.Profile.id).all()]


def _already_sent_since(user_id: str, title: str, since: date) -> bool:
    """เช็คว่ามีแจ้งเตือน title ตรงกันของ user นี้ ที่ส่งไปแล้วตั้งแต่วันที่ since เป็นต้นมาหรือยัง"""
    with SessionLocal() as db:
        row = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == user_id,
                models.Notification.title == title,
            )
            .order_by(models.Notification.created_at.desc())
            .first()
        )
        if not row:
            return False
        try:
            sent_date = datetime.fromisoformat(str(row.created_at)).date()
        except ValueError:
            return False
        return sent_date >= since


async def _sent_since(user_id: str, title: str, since: date) -> bool:
    # _already_sent_since ทำ DB query แบบ sync (psycopg2 block) — ถ้าเรียกตรงๆใน async def
    # จะกิน event loop เดียวกันกับที่ FastAPI ใช้รับ request อื่นๆ ทำให้ request พร้อมกัน (เช่น
    # dashboard summary) timeout เพราะ loop ถูกบล็อกรอ DB อยู่ ต้อง offload เข้า thread pool
    return await asyncio.to_thread(_already_sent_since, user_id, title, since)


async def _check_user(user_id: str, now: datetime) -> None:
    today = now.date()

    try:
        if now.hour >= REMINDER_HOUR and not await _sent_since(user_id, REMINDER_TITLE, today):
            await run_daily_reminder(user_id)
    except Exception:
        logger.exception("Daily reminder check failed for user_id=%s (non-fatal)", user_id)

    try:
        if now.hour >= GOAL_RECAP_HOUR and not await _sent_since(user_id, GOAL_RECAP_TITLE, today):
            await run_daily_goal_recap(user_id)
    except Exception:
        logger.exception("Daily goal recap check failed for user_id=%s (non-fatal)", user_id)

    try:
        if now.hour >= GOAL_RECAP_HOUR and not await _sent_since(user_id, SODIUM_GOOD_DAY_TITLE, today):
            await run_sodium_good_day(user_id)
    except Exception:
        logger.exception("Sodium good-day check failed for user_id=%s (non-fatal)", user_id)

    try:
        if now.hour >= GOAL_RECAP_HOUR:
            streak = await asyncio.to_thread(_current_logging_streak, user_id)
            if streak in STREAK_MILESTONES:
                streak_title = f"ต่อเนื่อง {streak} วันแล้ว! 🔥"
                if not await _sent_since(user_id, streak_title, today):
                    await run_streak_check(user_id)
    except Exception:
        logger.exception("Streak check failed for user_id=%s (non-fatal)", user_id)

    try:
        if now.weekday() == 0:  # Monday
            week_start = today - timedelta(days=today.weekday())
            if not await _sent_since(user_id, WEEKLY_TITLE, week_start):
                await run_weekly_summary(user_id)
    except Exception:
        logger.exception("Weekly summary check failed for user_id=%s (non-fatal)", user_id)

    try:
        if today.day == 1:
            month_start = today.replace(day=1)
            if not await _sent_since(user_id, MONTHLY_TITLE, month_start):
                await run_monthly_summary(user_id)
    except Exception:
        logger.exception("Monthly summary check failed for user_id=%s (non-fatal)", user_id)

    try:
        if today.month == 1 and today.day == 1:
            year_start = today.replace(month=1, day=1)
            if not await _sent_since(user_id, YEARLY_TITLE, year_start):
                await run_yearly_summary(user_id)
    except Exception:
        logger.exception("Yearly summary check failed for user_id=%s (non-fatal)", user_id)


async def _run_once() -> None:
    now = datetime.now()
    user_ids = await asyncio.to_thread(_all_user_ids)
    logger.info("Notification scheduler tick: checking %d users", len(user_ids))
    for user_id in user_ids:
        await _check_user(user_id, now)


async def _loop() -> None:
    # หน่วงสตาร์ทแรกสุด 60s ให้แอป/DB พร้อมก่อน (กัน race กับ initialize_storage ตอน boot)
    await asyncio.sleep(60)
    while True:
        try:
            await _run_once()
        except Exception:
            logger.exception("Notification scheduler tick crashed (non-fatal, will retry next interval)")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


def start() -> None:
    """เรียกจาก main.py lifespan ตอน startup"""
    global _task
    if _task is not None:
        return
    _task = asyncio.create_task(_loop())
    logger.info("Notification scheduler started (interval=%ss, reminder_hour=%s)", CHECK_INTERVAL_SECONDS, REMINDER_HOUR)


def stop() -> None:
    """เรียกจาก main.py lifespan ตอน shutdown"""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
