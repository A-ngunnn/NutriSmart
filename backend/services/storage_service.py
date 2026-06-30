import logging
import threading
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from config import get_settings
from database import SessionLocal, engine, Base
import models
from sqlalchemy import text, func

settings = get_settings()

DEFAULT_USER_ID = "default"


def initialize_storage() -> None:
    Base.metadata.create_all(bind=engine)
    # sample_count was added after the table already existed in some deployments
    try:
        with SessionLocal() as db:
            db.execute(text(
                "ALTER TABLE global_food_items ADD COLUMN IF NOT EXISTS sample_count INTEGER NOT NULL DEFAULT 1"
            ))
            db.commit()
    except Exception:
        logging.getLogger("nutrismart.storage").exception("sample_count migration check failed")
    # chronic_disease was added after the profiles table already existed in some deployments
    try:
        with SessionLocal() as db:
            db.execute(text(
                "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chronic_disease VARCHAR"
            ))
            db.commit()
    except Exception:
        logging.getLogger("nutrismart.storage").exception("chronic_disease migration check failed")
    # avatar_url and email were added after the profiles table already existed in some deployments
    try:
        with SessionLocal() as db:
            db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))
            db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR"))
            db.commit()
    except Exception:
        logging.getLogger("nutrismart.storage").exception("avatar_url/email migration check failed")

    # image_url was added after the scan_history table already existed
    try:
        with SessionLocal() as db:
            db.execute(text("ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
            db.commit()
    except Exception:
        logging.getLogger("nutrismart.storage").exception("image_url migration check failed")

    # avatar_url was added to reviews after the table was first created on some deployments —
    # create_all() only creates missing tables, it never ALTERs columns onto an existing one,
    # so any reviews table created before this field was added is left without it, causing
    # every POST /api/reviews to fail with a raw "column does not exist" 500 error
    try:
        with SessionLocal() as db:
            db.execute(text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))
            db.commit()
    except Exception:
        logging.getLogger("nutrismart.storage").exception("reviews.avatar_url migration check failed")
def _today_str() -> str:
    return date.today().isoformat()


def _model_to_dict(obj) -> dict:
    """
    แปลง SQLAlchemy row เป็น dict — และ "ปรับค่าให้เป็น string เสมอ" สำหรับคอลัมน์ date/datetime
    เหตุผล: ตารางจริงบน Supabase (Postgres) ใช้ native column type เป็น `date` (เช่น food_logs.date,
    scan_history.date, water_logs.date) แม้โมเดล SQLAlchemy ฝั่งนี้จะประกาศเป็น Column(String) ก็ตาม
    เมื่ออ่านกลับมา psycopg2/SQLAlchemy จะคืนค่าเป็น datetime.date object จริงๆ (ไม่ใช่ str)
    ซึ่งจะไป "เทียบกับ string ไม่ได้" (TypeError) หรือ "เทียบไม่ตรงแบบเงียบๆ" (เช่น e["date"] == "2026-06-15"
    จะเป็น False เสมอ ทำให้ last_7_days ว่างทั้งที่มีข้อมูลจริง) ในโค้ดส่วน get_health_summary และที่อื่นๆ
    ที่สมมติว่า date เป็น string เสมอ — แปลงให้เป็น isoformat() string ตรงจุดเดียวที่นี่ ป้องกันบั๊กนี้ทุกจุด
    (กับ SQLite ที่ใช้ตอน dev/test ในเครื่อง ค่าจะเป็น str อยู่แล้ว ฟังก์ชันนี้จะไม่เปลี่ยนแปลงอะไร)
    """
    result = {}
    for c in obj.__table__.columns:
        value = getattr(obj, c.name)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        result[c.name] = value
    return result


def get_profile(user_id: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        profile = db.query(models.Profile).filter(models.Profile.id == user_id).first()
        if profile is None:
            return {
                "id": user_id,
                "name": "",
                "email": "",
                "avatar_url": "",
                "age": "",
                "gender": "male",
                "weight": "",
                "height": "",
                "activity_level": "sedentary",
                "goal": "maintain",
                "chronic_disease": "",
            }
        return _model_to_dict(profile)


def upsert_profile(user_id: Optional[str], profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create or update a user profile row.

    avatar_url preservation rule:
    - If caller sends a non-None/non-empty value → overwrite (user chose new photo)
    - If caller sends None or omits the key → keep existing value in DB (don't clear the photo)
    This prevents a plain profile-info save from accidentally wiping the avatar.
    """
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    with SessionLocal() as db:
        profile = db.query(models.Profile).filter(models.Profile.id == user_id).first()
        if profile:
            profile.name = profile_data.get("name", "")
            profile.email = profile_data.get("email") or profile.email or ""
            profile.age = profile_data.get("age", "")
            profile.gender = profile_data.get("gender", "male")
            profile.weight = profile_data.get("weight", "")
            profile.height = profile_data.get("height", "")
            profile.activity_level = profile_data.get("activity_level", "sedentary")
            profile.goal = profile_data.get("goal", "maintain")
            profile.chronic_disease = profile_data.get("chronic_disease", "")
            # Preserve existing avatar_url unless a new non-empty value is explicitly provided
            new_avatar = profile_data.get("avatar_url")
            if new_avatar:  # truthy = non-None, non-empty string
                profile.avatar_url = new_avatar
        else:
            profile = models.Profile(
                id=user_id,
                name=profile_data.get("name", ""),
                email=profile_data.get("email", ""),
                avatar_url=profile_data.get("avatar_url", ""),
                age=profile_data.get("age", ""),
                gender=profile_data.get("gender", "male"),
                weight=profile_data.get("weight", ""),
                height=profile_data.get("height", ""),
                activity_level=profile_data.get("activity_level", "sedentary"),
                goal=profile_data.get("goal", "maintain"),
                chronic_disease=profile_data.get("chronic_disease", ""),
                created_at=now
            )
            db.add(profile)
        db.commit()
        db.refresh(profile)
        return _model_to_dict(profile)


def upsert_device_token(user_id: Optional[str], fcm_token: str) -> Dict[str, Any]:
    """ลงทะเบียน FCM token ของอุปกรณ์นี้ — ถ้า token เดิมเคยผูกกับ user คนอื่น (เช่น เครื่องสาธารณะที่
    มีคนสลับ login) ให้ย้ายมาเป็นของ user คนปัจจุบันแทน (อัปเดต user_id) ไม่ insert ซ้ำเพราะ fcm_token unique"""
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    with SessionLocal() as db:
        existing = db.query(models.DeviceToken).filter(models.DeviceToken.fcm_token == fcm_token).first()
        if existing:
            existing.user_id = user_id
            db.commit()
            db.refresh(existing)
            return _model_to_dict(existing)
        row = models.DeviceToken(id=str(uuid.uuid4()), user_id=user_id, fcm_token=fcm_token, created_at=now)
        db.add(row)
        db.commit()
        db.refresh(row)
        return _model_to_dict(row)


def get_device_tokens(user_id: Optional[str]) -> List[str]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        rows = db.query(models.DeviceToken.fcm_token).filter(models.DeviceToken.user_id == user_id).all()
        return [r[0] for r in rows]


def remove_device_token(fcm_token: str) -> bool:
    """ลบ token ที่หมดอายุ/ถูก revoke ออกจาก DB (เรียกจาก fcm_service ตอนเจอ UnregisteredError)
    หรือเรียกตอนผู้ใช้กดปิดการแจ้งเตือนบนอุปกรณ์นี้"""
    with SessionLocal() as db:
        row = db.query(models.DeviceToken).filter(models.DeviceToken.fcm_token == fcm_token).first()
        if row:
            db.delete(row)
            db.commit()
            return True
        return False


def get_food_entries(user_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        query = db.query(models.FoodLog).filter(models.FoodLog.user_id == user_id)
        if start_date:
            query = query.filter(models.FoodLog.date >= start_date)
        if end_date:
            query = query.filter(models.FoodLog.date <= end_date)
        query = query.order_by(models.FoodLog.created_at.desc())
        rows = query.all()
        return [_model_to_dict(row) for row in rows]


def insert_food_entry(user_id: Optional[str], entry: Dict[str, Any], bg_tasks=None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    entry_id = str(uuid.uuid4())
    entry_date = entry.get("date", _today_str())
    with SessionLocal() as db:
        new_entry = models.FoodLog(
            id=entry_id,
            user_id=user_id,
            name=entry["name"],
            meal_type=entry["meal_type"],
            calories=float(entry["calories"]),
            protein=float(entry["protein"]),
            carbs=float(entry["carbs"]),
            fat=float(entry["fat"]),
            date=entry_date,
            created_at=now
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        result = _model_to_dict(new_entry)

    # ── Auto-Triggers ──────────────────────────────────────────────────────────
    _check_sodium_and_notify(user_id, entry_date, bg_tasks=bg_tasks)
    _check_calories_and_notify(user_id, entry_date, bg_tasks=bg_tasks)
    _check_welcome_back_and_notify(user_id, entry_date, bg_tasks=bg_tasks)

    # อัปเดต GlobalFoodItem catalog (non-fatal) — ทุกมื้อที่บันทึก (ไม่ว่าจะกรอกมือหรือ AI
    # ประมาณค่า) ช่วยเติมคลังเมนูกลาง ให้ครั้งต่อไปที่มีคนค้นชื่อนี้ ไม่ต้องเรียก AI ซ้ำ
    try:
        from routers.food_search import upsert_global_food
        upsert_global_food(
            name=entry["name"],
            calories=float(entry["calories"]),
            protein=float(entry["protein"]),
            carbs=float(entry["carbs"]),
            fat=float(entry["fat"]),
            source="diary",
        )
    except Exception:
        pass

    return result


# ── Sodium / Calories Auto-Trigger Helpers ──────────────────────────────────
SODIUM_DAILY_LIMIT_MG = 2_000.0

# กันสองคำขอที่เข้ามาพร้อมกัน (เช่น เพิ่มอาหาร 2 รายการห่างกันไม่กี่ร้อย ms) ทั้งคู่ผ่านเช็ก
# "ยังไม่เคยแจ้งเตือนวันนี้" พร้อมกันก่อนที่อีกฝั่งจะ commit ทัน — ใช้ lock ต่อ (user_id, วันที่,
# ประเภท) บีบให้ check-then-insert เป็น atomic ภายใน process เดียวกัน (กัน duplicate ที่เกิดจาก
# race condition ได้จริงสำหรับ deployment แบบ single worker)
_notify_locks: Dict[str, threading.Lock] = {}
_notify_locks_guard = threading.Lock()


def _get_notify_lock(key: str) -> threading.Lock:
    with _notify_locks_guard:
        lock = _notify_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _notify_locks[key] = lock
        return lock


def _is_same_day(created_at: str, check_date: str) -> bool:
    """created_at เป็น full ISO datetime, check_date เป็น 'YYYY-MM-DD' — เทียบแค่ส่วนวันที่"""
    return str(created_at)[:10] == check_date


def _check_sodium_and_notify(user_id: str, check_date: str, bg_tasks=None) -> None:
    """
    คำนวณโซเดียมรวมจาก ScanHistory ของวันที่ระบุ
    ถ้าเกิน 2,000 mg → INSERT notification เตือน (ไม่เตือนซ้ำวันเดียวกัน)
    """
    lock = _get_notify_lock(f"sodium:{user_id}:{check_date}")
    with lock:
        try:
            with SessionLocal() as db:
                # คำนวณโซเดียมรวมจาก scan_history วันนี้โดยใช้ Database Aggregation
                total_sodium_scalar = db.query(func.sum(models.ScanHistory.sodium)).filter(
                    models.ScanHistory.user_id == user_id,
                    models.ScanHistory.date == check_date,
                ).scalar()
                total_sodium = float(total_sodium_scalar or 0)

                if total_sodium < SODIUM_DAILY_LIMIT_MG:
                    return  # ยังไม่เกินเกณฑ์ ไม่ต้องแจ้งเตือน

                notif_title = "⚠️ โซเดียมเกินเกณฑ์!"

                # ── เช็ก Dedup: เทียบ title ตรงตัว (ไม่ใช่ fuzzy %keyword%) + วันที่ตรงกันจริง ──
                same_title_rows = (
                    db.query(models.Notification.created_at)
                    .filter(
                        models.Notification.user_id == user_id,
                        models.Notification.category == "goal",
                        models.Notification.title == notif_title,
                    )
                    .all()
                )
                if any(_is_same_day(r[0], check_date) for r in same_title_rows):
                    return  # เคยเตือนไปแล้ววันนี้

                # ── INSERT notification ──────────────────────────────────────────
                nid = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                day_label = "วันนี้" if check_date == _today_str() else f"วันที่ {check_date}"
                notif_body = (
                    f"{day_label}คุณได้รับโซเดียมสะสม {total_sodium:.0f} mg "
                    f"ซึ่งเกินค่าแนะนำ {SODIUM_DAILY_LIMIT_MG:.0f} mg/วัน "
                    "แนะนำให้มื้อต่อไปเลือกอาหารรสอ่อนและลดเครื่องปรุงนะคะ 🧂"
                )
                notif = models.Notification(
                    id=nid,
                    user_id=user_id,
                    category="goal",
                    priority="high",
                    title=notif_title,
                    body=notif_body,
                    emoji="🧂",
                    is_read=False,
                    is_dismissed=False,
                    created_at=now,
                )
                db.add(notif)
                db.commit()

                # ── ส่ง Web Push ผ่าน FCM (Background Task Native by FastAPI) ────────
                try:
                    from services.fcm_service import send_push_if_available

                    if bg_tasks:
                        bg_tasks.add_task(
                            send_push_if_available,
                            user_id=user_id,
                            title=notif_title,
                            body=notif_body,
                            emoji="🧂",
                            category="goal",
                            priority="high",
                        )
                except Exception as push_exc:
                    logging.getLogger("nutrismart.storage").warning(
                        "[FCM] Sodium push failed to queue (non-fatal): %s", push_exc
                    )

        except Exception as exc:
            # ไม่ให้ error ของ notification ทำให้ food log พัง
            logging.getLogger("nutrismart.storage").warning(
                "Sodium notify error (non-fatal): %s", exc
            )

# ── Calories Auto-Trigger Helper ─────────────────────────────────────────────
def _check_calories_and_notify(user_id: str, check_date: str, bg_tasks=None) -> None:
    """
    คำนวณแคลอรีรวมจาก FoodLog ของวันที่ระบุ
    ถ้าเกินเป้าหมาย (TDEE หรือค่าคงที่ 2000) → INSERT notification เตือน (ไม่เตือนซ้ำวันเดียวกัน)
    """
    lock = _get_notify_lock(f"calories:{user_id}:{check_date}")
    with lock:
        try:
            with SessionLocal() as db:
                # คำนวณแคลอรีรวมจาก FoodLog ของวันนี้โดยใช้ Database Aggregation
                total_calories_scalar = db.query(func.sum(models.FoodLog.calories)).filter(
                    models.FoodLog.user_id == user_id,
                    models.FoodLog.date == check_date,
                ).scalar()
                total_calories = float(total_calories_scalar or 0)

                profile_row = db.query(models.Profile).filter(models.Profile.id == user_id).first()
                limit = _calc_tdee(_model_to_dict(profile_row)) if profile_row else 0
                if limit <= 0:
                    limit = 2000.0

                if total_calories <= limit:
                    return  # ยังไม่เกินเกณฑ์ ไม่ต้องแจ้งเตือน

                notif_title = "🔥 พลังงานเกินเป้าหมายแล้ว!"

                # ── เช็ก Dedup: เทียบ title ตรงตัว (เดิมเช็ก "แคลอรี" ซึ่งไม่ตรงกับ title จริง
                # ที่ใช้คำว่า "พลังงาน" — ทำให้ dedup ไม่เคยเจอแมตช์และสร้างซ้ำได้ไม่จำกัดมาก่อน) ──
                same_title_rows = (
                    db.query(models.Notification.created_at)
                    .filter(
                        models.Notification.user_id == user_id,
                        models.Notification.category == "goal",
                        models.Notification.title == notif_title,
                    )
                    .all()
                )
                if any(_is_same_day(r[0], check_date) for r in same_title_rows):
                    return  # เคยเตือนไปแล้ววันนี้

                # ── INSERT notification ──────────────────────────────────────────
                nid = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                day_label = "วันนี้" if check_date == _today_str() else f"วันที่ {check_date}"
                notif_body = (
                    f"{day_label}คุณได้รับพลังงานไปแล้ว {total_calories:.0f} kcal "
                    f"ซึ่งเกินเป้าหมายที่ {limit:.0f} kcal/วัน "
                    "มื้อถัดไปลองเลือกทานอาหารเบาๆ เช่น สลัด หรือผลไม้แทนนะคะ 🥗"
                )
                notif = models.Notification(
                    id=nid,
                    user_id=user_id,
                    category="goal",
                    priority="high",
                    title=notif_title,
                    body=notif_body,
                    emoji="🔥",
                    is_read=False,
                    is_dismissed=False,
                    created_at=now,
                )
                db.add(notif)
                db.commit()

                # ── ส่ง Web Push ผ่าน FCM ────────────────
                try:
                    from services.fcm_service import send_push_if_available

                    if bg_tasks:
                        bg_tasks.add_task(
                            send_push_if_available,
                            user_id=user_id,
                            title=notif_title,
                            body=notif_body,
                            emoji="🔥",
                            category="goal",
                            priority="high",
                        )
                except Exception as push_exc:
                    logging.getLogger("nutrismart.storage").warning(
                        "[FCM] Calories push failed to queue: %s", push_exc
                    )

        except Exception as exc:
            logging.getLogger("nutrismart.storage").warning(
                "Calories notify error (non-fatal): %s", exc
            )


# ── Welcome-back Auto-Trigger Helper ─────────────────────────────────────────
# เดิมระบบมีแต่ "เทรนเนอร์มาตามจิก" (REMINDER_TITLE) ตอนหายไป ไม่มีคำทักทายเชิงบวกตอนกลับมาเลย
def _check_welcome_back_and_notify(user_id: str, check_date: str, bg_tasks=None) -> None:
    """ถ้านี่คือบันทึกอาหารรายการแรกของวันนี้ และก่อนหน้านี้ขาดบันทึกไปอย่างน้อย 2 วันเต็ม
    (กลับมาหลังจากหายไป) → ทักทายให้กำลังใจ แทนที่จะมีแต่การตามจิกตอนหายไปอย่างเดียว"""
    lock = _get_notify_lock(f"welcome_back:{user_id}:{check_date}")
    with lock:
        try:
            with SessionLocal() as db:
                today_count = db.query(models.FoodLog).filter(
                    models.FoodLog.user_id == user_id, models.FoodLog.date == check_date,
                ).count()
                if today_count != 1:
                    return  # ไม่ใช่รายการแรกของวันนี้ — เช็คไปแล้วตอนรายการแรก ไม่ต้องเช็คซ้ำ

                prev_row = (
                    db.query(models.FoodLog.date)
                    .filter(models.FoodLog.user_id == user_id, models.FoodLog.date < check_date)
                    .order_by(models.FoodLog.date.desc())
                    .first()
                )
                if not prev_row:
                    return  # ไม่มีประวัติเก่า (user ใหม่) ไม่ต้อง "ต้อนรับกลับมา"

                gap_days = (date.fromisoformat(check_date) - date.fromisoformat(str(prev_row[0]))).days
                if gap_days < 2:
                    return  # หายไปไม่ถึง 2 วันเต็ม ไม่ถือว่า "หายไปนาน"

                notif_title = "ยินดีต้อนรับกลับมา! 🌟"
                same_title_rows = (
                    db.query(models.Notification.created_at)
                    .filter(models.Notification.user_id == user_id, models.Notification.title == notif_title)
                    .all()
                )
                if any(_is_same_day(r[0], check_date) for r in same_title_rows):
                    return

                now = datetime.utcnow().isoformat()
                notif_body = (
                    f"หายไป {gap_days} วันเลยนะคะ ดีใจที่กลับมาบันทึกอาหารต่ออีกครั้ง "
                    "ไม่ว่าจะห่างไปนานแค่ไหน เริ่มต้นใหม่ได้เสมอ สู้ๆ นะคะ 💪"
                )
                notif = models.Notification(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    category="daily",
                    priority="medium",
                    title=notif_title,
                    body=notif_body,
                    emoji="🌟",
                    is_read=False,
                    is_dismissed=False,
                    created_at=now,
                )
                db.add(notif)
                db.commit()

                if bg_tasks:
                    try:
                        from services.fcm_service import send_push_if_available
                        bg_tasks.add_task(
                            send_push_if_available,
                            user_id=user_id,
                            title=notif_title,
                            body=notif_body,
                            emoji="🌟",
                            category="daily",
                            priority="medium",
                        )
                    except Exception as push_exc:
                        logging.getLogger("nutrismart.storage").warning(
                            "[FCM] Welcome-back push failed to queue: %s", push_exc
                        )
        except Exception as exc:
            logging.getLogger("nutrismart.storage").warning(
                "Welcome-back notify error (non-fatal): %s", exc
            )


def delete_food_entry(user_id: Optional[str], entry_id: str) -> bool:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        entry = db.query(models.FoodLog).filter(models.FoodLog.id == entry_id, models.FoodLog.user_id == user_id).first()
        if entry:
            db.delete(entry)
            db.commit()
            return True
        return False


def get_water_entries(user_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        query = db.query(models.WaterLog).filter(models.WaterLog.user_id == user_id)
        if start_date:
            query = query.filter(models.WaterLog.date >= start_date)
        if end_date:
            query = query.filter(models.WaterLog.date <= end_date)
        query = query.order_by(models.WaterLog.created_at.desc())
        rows = query.all()
        return [_model_to_dict(row) for row in rows]


def insert_water_entry(user_id: Optional[str], amount: float, entry_date: Optional[str] = None, bg_tasks=None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    entry_id = str(uuid.uuid4())
    entry_date = entry_date or _today_str()

    # ล็อกทั้งฟังก์ชันต่อ (user, วัน) — กันแท็บ/ปุ่มกดรัวๆ พร้อมกันแล้ว count_today query ของแต่ละ
    # request เห็นค่า 0 เหมือนกันหมดก่อนใครจะ commit ทัน ทำให้ insert แจ้งเตือน "เริ่มต้นวันด้วยน้ำ"
    # ซ้ำกันหลายใบ (เคยเกิดจริง — เจอ 3 ใบ timestamp เดียวกัน) เหมือนบั๊กเดิมที่เคยแก้ใน sodium/calories
    lock = _get_notify_lock(f"water:{user_id}:{entry_date}")
    with lock, SessionLocal() as db:
        # Check if this is the first water log of the day
        count_today = db.query(models.WaterLog).filter(
            models.WaterLog.user_id == user_id,
            models.WaterLog.date == entry_date
        ).count()
        is_first = (count_today == 0)

        # เช็คว่ารายการนี้จะทำให้ดื่มน้ำครบเป้าหมายของวันนี้พอดี (ข้าม threshold) เพื่อส่งแจ้งเตือนเชิงบวก
        # ครั้งเดียวตอนที่ "ครบ" ไม่ใช่ทุกครั้งที่ดื่มหลังครบไปแล้ว
        water_before_scalar = db.query(func.sum(models.WaterLog.amount)).filter(
            models.WaterLog.user_id == user_id,
            models.WaterLog.date == entry_date,
        ).scalar()
        water_before = float(water_before_scalar or 0)
        water_after = water_before + float(amount)
        profile_for_target = get_profile(user_id)
        water_target = _water_target(profile_for_target)
        just_hit_water_goal = water_target > 0 and water_before < water_target <= water_after

        new_entry = models.WaterLog(
            id=entry_id,
            user_id=user_id,
            amount=float(amount),
            date=entry_date,
            created_at=now
        )
        db.add(new_entry)

        if is_first:
            nid = str(uuid.uuid4())
            notif_title = "เยี่ยมมาก เริ่มต้นวันด้วยการดื่มน้ำ!"
            notif_body = "เริ่มต้นวันใหม่ได้อย่างสดชื่น อย่าลืมจิบน้ำเรื่อยๆ ตลอดวันนะคะ 💧"
            notif = models.Notification(
                id=nid,
                user_id=user_id,
                category="daily",
                priority="medium",
                title=notif_title,
                body=notif_body,
                emoji="💧",
                is_read=False,
                is_dismissed=False,
                created_at=now,
            )
            db.add(notif)
            if bg_tasks:
                from services.fcm_service import send_push_if_available
                bg_tasks.add_task(
                    send_push_if_available,
                    user_id=user_id,
                    title=notif_title,
                    body=notif_body,
                    emoji="💧",
                    category="daily",
                    priority="medium"
                )

        if just_hit_water_goal:
            nid2 = str(uuid.uuid4())
            notif_title2 = "ดื่มน้ำครบเป้าหมายแล้ว! 🎉"
            notif_body2 = (
                f"เยี่ยมมาก! วันนี้คุณดื่มน้ำครบ {water_target:,} ml ตามเป้าหมายแล้ว "
                "ร่างกายได้รับน้ำเพียงพอ รักษาพฤติกรรมนี้ไว้นะคะ"
            )
            notif2 = models.Notification(
                id=nid2,
                user_id=user_id,
                category="daily",
                priority="medium",
                title=notif_title2,
                body=notif_body2,
                emoji="🎉",
                is_read=False,
                is_dismissed=False,
                created_at=now,
            )
            db.add(notif2)
            if bg_tasks:
                from services.fcm_service import send_push_if_available
                bg_tasks.add_task(
                    send_push_if_available,
                    user_id=user_id,
                    title=notif_title2,
                    body=notif_body2,
                    emoji="🎉",
                    category="daily",
                    priority="medium"
                )

        db.commit()
        db.refresh(new_entry)
        return _model_to_dict(new_entry)


def delete_water_entry(user_id: Optional[str], entry_id: str) -> bool:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        try:
            entry = db.query(models.WaterLog).filter(models.WaterLog.id == entry_id, models.WaterLog.user_id == user_id).first()
        except Exception:
            # entry_id ที่ไม่ใช่ uuid ที่ถูกต้อง (เช่น optimistic id จากฝั่ง client ที่ยังไม่ถูกแทนที่)
            # ถือว่าหาไม่เจอ ไม่ใช่ error ของเซิร์ฟเวอร์
            db.rollback()
            return False
        if entry:
            db.delete(entry)
            db.commit()
            return True
        return False


def get_scan_history(user_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        query = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == user_id).order_by(models.ScanHistory.created_at.desc())
        if limit:
            query = query.limit(limit)
        rows = query.all()
        return [_model_to_dict(row) for row in rows]


def insert_scan_record(user_id: Optional[str], scan_data: Dict[str, Any], bg_tasks=None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    record_id = str(uuid.uuid4())
    entry_date = scan_data.get("date", _today_str())
    with SessionLocal() as db:
        new_record = models.ScanHistory(
            id=record_id,
            user_id=user_id,
            product_name=scan_data["product_name"],
            calories=float(scan_data["calories"]),
            protein=float(scan_data["protein"]),
            carbs=float(scan_data["carbs"]),
            total_fat=float(scan_data["total_fat"]),
            sugar=float(scan_data["sugar"]),
            sodium=float(scan_data["sodium"]),
            score=float(scan_data["score"]),
            status=scan_data["status"],
            image_url=scan_data.get("image_url"),
            date=entry_date,
            created_at=now
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        
    _check_sodium_and_notify(user_id, entry_date, bg_tasks)

    # อัปเดต GlobalFoodItem catalog (non-fatal)
    try:
        from routers.food_search import upsert_global_food
        upsert_global_food(
            name=scan_data["product_name"],
            calories=float(scan_data["calories"]),
            protein=float(scan_data["protein"]),
            carbs=float(scan_data["carbs"]),
            fat=float(scan_data["total_fat"]),
            source="scan",
        )
    except Exception:
        pass

    return _model_to_dict(new_record)


def upsert_review(user_id: str, name: str, rating: int, comment: str, avatar_url: Optional[str] = None) -> Dict[str, Any]:
    """1 user มีรีวิวได้อันเดียว — ถ้าเคยส่งแล้วให้แก้ของเดิมแทนสร้างซ้ำ (กันคนกดส่งซ้ำๆเพื่อยึดพื้นที่หน้า landing page)"""
    now = datetime.utcnow().isoformat()
    with SessionLocal() as db:
        existing = db.query(models.Review).filter(models.Review.user_id == user_id).first()
        if existing:
            existing.name = name
            existing.rating = rating
            existing.comment = comment
            existing.avatar_url = avatar_url
            existing.created_at = now
            db.commit()
            db.refresh(existing)
            return _model_to_dict(existing)

        new_review = models.Review(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            rating=rating,
            comment=comment,
            avatar_url=avatar_url,
            created_at=now,
        )
        db.add(new_review)
        db.commit()
        db.refresh(new_review)
        return _model_to_dict(new_review)


def get_public_reviews(limit: int = 9) -> List[Dict[str, Any]]:
    """รีวิว 4-5 ดาวล่าสุด ใช้โชว์บน landing page เท่านั้น — ไม่ต้องมี admin คัดเลือกมือ"""
    with SessionLocal() as db:
        rows = (
            db.query(models.Review)
            .filter(models.Review.rating >= 4)
            .order_by(models.Review.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_model_to_dict(row) for row in rows]


def get_my_review(user_id: str) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        row = db.query(models.Review).filter(models.Review.user_id == user_id).first()
        return _model_to_dict(row) if row else None


def insert_notification(
    user_id: str,
    category: str,
    priority: str,
    title: str,
    body: str,
    emoji: str,
) -> models.Notification:
    """INSERT notification เข้า DB แล้วคืน ORM object"""
    now = datetime.utcnow().isoformat()
    nid = str(uuid.uuid4())
    with SessionLocal() as db:
        notif = models.Notification(
            id=nid,
            user_id=user_id,
            category=category,
            priority=priority,
            title=title,
            body=body,
            emoji=emoji,
            is_read=False,
            is_dismissed=False,
            created_at=now,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif


def check_and_log_api_usage(user_id: str, endpoint: str, max_limit: int = 10) -> bool:
    """
    ตรวจสอบว่าผู้ใช้ยิง Endpoint นี้เกินโควตาต่อวันหรือไม่
    ถ้ายังไม่เกิน จะบันทึกประวัติการยิงและคืนค่า True
    ถ้าเกินแล้ว จะคืนค่า False
    """
    if not user_id or user_id == DEFAULT_USER_ID:
        return True
        
    now = datetime.utcnow().isoformat()
    today = _today_str()
    log_id = str(uuid.uuid4())
    
    with SessionLocal() as db:
        count = db.query(models.ApiUsageLog).filter(
            models.ApiUsageLog.user_id == user_id,
            models.ApiUsageLog.endpoint == endpoint,
            models.ApiUsageLog.date == today
        ).count()
        
        if count >= max_limit:
            return False
            
        new_log = models.ApiUsageLog(
            id=log_id,
            user_id=user_id,
            endpoint=endpoint,
            date=today,
            created_at=now
        )
        db.add(new_log)
        db.commit()
        return True




def _calc_tdee(profile: Dict[str, Any]) -> int:
    try:
        weight = float(profile.get("weight") or 0)
        height = float(profile.get("height") or 0)
        age = float(profile.get("age") or 0)
        gender = profile.get("gender", "male")
    except (ValueError, TypeError):
        return 0
    if not weight or not height or not age:
        return 0
    bmr = 10 * weight + 6.25 * height - 5 * age + ( -161 if gender == "female" else 5)
    factor = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }.get(profile.get("activity_level"), 1.2)
    tdee = bmr * factor
    if profile.get("goal") == "lose":
        tdee -= 500
    elif profile.get("goal") == "gain":
        tdee += 500
    elif profile.get("goal") == "muscle":
        tdee += 300
    return int(round(tdee))


def _water_target(profile: Dict[str, Any]) -> int:
    try:
        weight = float(profile.get("weight") or 0)
    except (ValueError, TypeError):
        return 2000
    return int(round(weight * 33)) if weight > 0 else 2000


def get_dashboard_summary(user_id: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    profile = get_profile(user_id)
    today = _today_str()
    food_entries = get_food_entries(user_id, start_date=today, end_date=today)
    water_entries = get_water_entries(user_id, start_date=today, end_date=today)

    with SessionLocal() as db:
        scan_count = db.query(func.count(models.ScanHistory.id)).filter(
            models.ScanHistory.user_id == user_id
        ).scalar() or 0

    calories_today = sum(float(item["calories"]) for item in food_entries)
    meal_totals: Dict[str, float] = {}
    for item in food_entries:
        meal_totals[item["meal_type"]] = meal_totals.get(item["meal_type"], 0) + float(item["calories"])

    return {
        "profile": profile,
        "bmi": float(profile.get("weight") or 0) / ((float(profile.get("height") or 0) / 100) ** 2) if profile.get("weight") and profile.get("height") else 0,
        "tdee": _calc_tdee(profile),
        "calories_today": int(round(calories_today)),
        "calories_remaining": max(0, _calc_tdee(profile) - int(round(calories_today))) if _calc_tdee(profile) > 0 else 0,
        "scan_count": scan_count,
        "water_today": int(round(sum(float(item["amount"]) for item in water_entries))),
        "water_target": _water_target(profile),
        "meal_totals": meal_totals,
    }


_THAI_DAY = {"Mon": "จ", "Tue": "อ", "Wed": "พ", "Thu": "พฤ", "Fri": "ศ", "Sat": "ส", "Sun": "อา"}
_THAI_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
               "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

_HEALTH_SUMMARY_LOGGER = logging.getLogger("nutrismart.health_summary")


def _empty_health_summary(user_id: Optional[str] = None) -> Dict[str, Any]:
    """โครงสร้างเริ่มต้นที่ปลอดภัย — ใช้เมื่อผู้ใช้ใหม่ยังไม่มีข้อมูล หรือเกิดข้อผิดพลาดใดๆ ก็ตาม ห้ามคืน 500 เด็ดขาด"""
    try:
        profile = get_profile(user_id)
    except Exception:
        _HEALTH_SUMMARY_LOGGER.exception("get_profile failed inside _empty_health_summary fallback")
        profile = {
            "id": user_id or DEFAULT_USER_ID, "name": "", "age": "", "gender": "male",
            "weight": "", "height": "", "activity_level": "sedentary", "goal": "maintain",
            "chronic_disease": "",
        }
    return {
        "profile": profile,
        "tdee": 0,
        "last_7_days": [],
        "avg_calories": 0,
        "avg_scan_score": 0,
        "scan_count": 0,
        "macro_totals": {"protein": 0, "carbs": 0, "fat": 0},
        "scan_history": [],
        "monthly_data": [],
        "monthly_stats": {"avg_calories": 0, "avg_scan_score": 0, "scan_count": 0},
        "yearly_data": [],
        "yearly_stats": {"avg_calories": 0, "avg_scan_score": 0, "scan_count": 0},
    }


def _sync_health_summary_cache(
    user_id: str,
    last7days: List[Dict[str, Any]],
    water_by_date: Dict[str, float],
    week_start_iso: str,
    today_iso: str,
    avg_calories_weekly: float,
    monthly_stats: Dict[str, Any],
    first_of_month_iso: str,
    month_total_calories: float,
    month_days: int,
) -> None:
    """
    เติม cache ลง public.daily_health_summaries / public.weekly_monthly_summaries
    แบบ "ธุรกรรมเดียว" (1 session, 1 commit) แทนที่จะแยกทำทีละวัน/ทีละช่วง (เดิม 9 round-trip ไป Supabase
    ทำให้หน้า dashboard โหลดช้าเกิน 15 วินาทีจนเบราว์เซอร์ TimeoutError) — ฟังก์ชันนี้ถูกเรียกจาก
    background thread เสมอ (ดู get_health_summary) จึงไม่บล็อก response ที่ส่งกลับให้ผู้ใช้แม้แต่นิดเดียว
    เป็น best-effort ล้วนๆ: ไม่ raise และไม่คืนค่าอะไรออกไป
    """
    try:
        now = datetime.utcnow().isoformat()
        dates = [d["date"] for d in last7days]
        with SessionLocal() as db:
            # หมายเหตุ: row.date ที่อ่านกลับมาจาก ORM ตรงๆ (ไม่ผ่าน _model_to_dict) อาจเป็น datetime.date
            # object บน Postgres จริง — ใช้ str() ครอบเพื่อให้ key ตรงกับ day["date"] ที่เป็น str เสมอ
            existing_daily = {
                str(row.date): row
                for row in db.query(models.DailyHealthSummary)
                .filter(
                    models.DailyHealthSummary.user_id == user_id,
                    models.DailyHealthSummary.date.in_(dates),
                )
                .all()
            }
            for day in last7days:
                water = float(water_by_date.get(day["date"], 0.0))
                row = existing_daily.get(day["date"])
                if row:
                    row.total_calories = float(day["calories"])
                    row.total_protein = float(day["protein"])
                    row.total_carbs = float(day["carbs"])
                    row.total_fat = float(day["fat"])
                    row.total_water = water
                    row.updated_at = now
                else:
                    db.add(models.DailyHealthSummary(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        date=day["date"],
                        total_calories=float(day["calories"]),
                        total_protein=float(day["protein"]),
                        total_carbs=float(day["carbs"]),
                        total_fat=float(day["fat"]),
                        total_water=water,
                        updated_at=now,
                    ))

            avg_water_week = sum(water_by_date.values()) / 7
            total_cal_week = sum(d["calories"] for d in last7days)
            period_rows = [
                ("weekly", week_start_iso, today_iso, avg_calories_weekly, total_cal_week, avg_water_week),
                ("monthly", first_of_month_iso, today_iso, monthly_stats["avg_calories"], month_total_calories, 0.0),
            ]
            for period_type, start_iso, end_iso, avg_cal, total_cal, avg_water in period_rows:
                row = (
                    db.query(models.WeeklyMonthlySummary)
                    .filter(
                        models.WeeklyMonthlySummary.user_id == user_id,
                        models.WeeklyMonthlySummary.period_type == period_type,
                        models.WeeklyMonthlySummary.start_date == start_iso,
                    )
                    .first()
                )
                if row:
                    row.end_date = end_iso
                    row.avg_calories = avg_cal
                    row.total_calories = total_cal
                    row.avg_water = avg_water
                    row.updated_at = now
                else:
                    db.add(models.WeeklyMonthlySummary(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        period_type=period_type,
                        start_date=start_iso,
                        end_date=end_iso,
                        avg_calories=avg_cal,
                        total_calories=total_cal,
                        avg_water=avg_water,
                        updated_at=now,
                    ))

            db.commit()
    except Exception:
        _HEALTH_SUMMARY_LOGGER.exception(
            "Background cache sync to daily_health_summaries/weekly_monthly_summaries failed for user_id=%s",
            user_id,
        )


def get_health_summary(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    สรุปข้อมูลสุขภาพของผู้ใช้สำหรับหน้า Dashboard
    คำนวณจาก food_logs/scan_history/water_logs ดิบเสมอ (เพื่อความถูกต้องแบบเรียลไทม์)
    แล้วเติมผลลัพธ์ลงตารางแคช daily_health_summaries / weekly_monthly_summaries แบบ write-through
    เพื่อให้ตารางสรุปมีข้อมูลจริงสำหรับงานอื่นๆ (เช่น รายงาน, แดชบอร์ดฝั่งอื่น) โดยไม่ต้องคำนวณซ้ำ

    ไม่ว่าจะเกิดข้อผิดพลาดใดๆ ก็ตาม (ผู้ใช้ใหม่ไม่มีข้อมูล, DB ขัดข้องชั่วคราว, ฯลฯ)
    ฟังก์ชันนี้จะไม่ raise exception ออกไปเด็ดขาด — จะคืนโครงสร้างค่าเริ่มต้น (เป็น 0 / [] ) แทนเสมอ
    """
    user_id = user_id or DEFAULT_USER_ID
    try:
        from calendar import monthrange
        from collections import defaultdict
        from concurrent.futures import ThreadPoolExecutor

        today = date.today()
        week_start = today - timedelta(days=6)
        year_start = (today - timedelta(days=365)).replace(day=1)

        def _fetch_scan_raw():
            with SessionLocal() as db:
                return db.query(models.ScanHistory.date, models.ScanHistory.score).filter(
                    models.ScanHistory.user_id == user_id
                ).all()

        def _fetch_year_entries():
            with SessionLocal() as db:
                return db.query(models.FoodLog.date, models.FoodLog.calories).filter(
                    models.FoodLog.user_id == user_id,
                    models.FoodLog.date >= year_start.isoformat(),
                    models.FoodLog.date <= today.isoformat()
                ).all()

        # 5 query ข้างบนนี้ไม่ขึ้นกับกันเลย แต่เดิมยิงทีละตัวแบบ sync เรียงกัน (sequential round-trip
        # ไป Supabase ทุกตัว) ทำให้เวลารวมบวมเป็นผลรวมของทุก query พร้อมกัน ทั้งที่รันคู่ขนานได้
        # เปลี่ยนมายิงพร้อมกันในเธรดแยก ลดเวลารวมให้เหลือแค่เท่าของ query ที่ช้าสุดตัวเดียว
        with ThreadPoolExecutor(max_workers=5) as pool:
            f_profile = pool.submit(get_profile, user_id)
            f_entries7 = pool.submit(get_food_entries, user_id, week_start.isoformat(), today.isoformat())
            f_water7 = pool.submit(get_water_entries, user_id, week_start.isoformat(), today.isoformat())
            f_scan_raw = pool.submit(_fetch_scan_raw)
            f_year_entries = pool.submit(_fetch_year_entries)

            profile = f_profile.result()
            entries7 = f_entries7.result()
            water7 = f_water7.result()
            scan_raw = f_scan_raw.result()
            year_entries_raw = f_year_entries.result()

        tdee = _calc_tdee(profile)

        # ── Weekly (last 7 days) ─────────────────────────────────────────────
        water_by_date: Dict[str, float] = defaultdict(float)
        for w in water7:
            water_by_date[str(w["date"])] += float(w["amount"])

        last7days = []
        for idx in range(6, -1, -1):
            current = today - timedelta(days=idx)
            date_str = current.isoformat()
            label = _THAI_DAY.get(current.strftime("%a"), current.strftime("%a"))
            day_ents = [e for e in entries7 if e["date"] == date_str]
            last7days.append({
                "date": date_str,
                "label": label,
                "calories": int(round(sum(float(e["calories"]) for e in day_ents))),
                "protein":  int(round(sum(float(e["protein"])  for e in day_ents))),
                "carbs":    int(round(sum(float(e["carbs"])    for e in day_ents))),
                "fat":      int(round(sum(float(e["fat"])      for e in day_ents))),
            })

        total_macros = {
            "protein": int(round(sum(d["protein"] for d in last7days))),
            "carbs":   int(round(sum(d["carbs"]   for d in last7days))),
            "fat":     int(round(sum(d["fat"]      for d in last7days))),
        }
        avg_calories_weekly = int(round(sum(d["calories"] for d in last7days) / 7))

        # ── Scan history ─────────────────────────────────────────────────────
        avg_score = (int(round(sum(float(s.score) for s in scan_raw) / len(scan_raw)))
                     if scan_raw else 0)

        # ── Yearly & Monthly Data (past 12 months) ───────────────────────────

        # Monthly (current month, week-by-week avg daily cal)
        first_of_month = today.replace(day=1)
        month_entries = [e for e in year_entries_raw if str(e.date) >= first_of_month.isoformat()]

        monthly_data = []
        w_start = first_of_month
        week_num = 1
        while w_start <= today:
            w_end = min(w_start + timedelta(days=6), today)
            w_ents = [e for e in month_entries
                      if w_start.isoformat() <= str(e.date) <= w_end.isoformat()]
            days_cnt = (w_end - w_start).days + 1
            avg_w = int(round(sum(float(e.calories) for e in w_ents) / max(1, days_cnt)))
            monthly_data.append({"week": f"สัปดาห์ {week_num}", "cal": avg_w})
            w_start = w_end + timedelta(days=1)
            week_num += 1

        this_month_str = today.strftime("%Y-%m")
        month_scans = [s for s in scan_raw if str(s.date)[:7] == this_month_str]
        month_avg_score = (int(round(sum(float(s.score) for s in month_scans) / len(month_scans)))
                           if month_scans else avg_score)
        monthly_stats = {
            "avg_calories": int(round(sum(d["cal"] for d in monthly_data) / max(1, len(monthly_data)))),
            "avg_scan_score": month_avg_score,
            "scan_count": len(month_scans),
        }

        # Yearly (past 12 months, monthly avg daily cal)
        cal_by_month: Dict[str, list] = defaultdict(list)
        for e in year_entries_raw:
            cal_by_month[str(e.date)[:7]].append(float(e.calories))

        yearly_data = []
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y:04d}-{m:02d}"
            days_in_m = monthrange(y, m)[1]
            cals = cal_by_month.get(key, [])
            avg_m = int(round(sum(cals) / days_in_m)) if cals else 0
            yearly_data.append({"month": _THAI_MONTH[m - 1], "cal": avg_m})

        year_scans = [s for s in scan_raw if str(s.date) >= year_start.isoformat()]
        year_avg_score = (int(round(sum(float(s.score) for s in year_scans) / len(year_scans)))
                          if year_scans else avg_score)
        non_zero = [d["cal"] for d in yearly_data if d["cal"] > 0]
        yearly_stats = {
            "avg_calories": int(round(sum(non_zero) / len(non_zero))) if non_zero else 0,
            "avg_scan_score": year_avg_score,
            "scan_count": len(year_scans),
        }

        result = {
            "profile":       profile,
            "tdee":          tdee,
            "last_7_days":   last7days,
            "avg_calories":  avg_calories_weekly,
            "avg_scan_score": avg_score,
            "scan_count":    len(scan_raw),
            "macro_totals":  total_macros,
            "scan_history":  [],
            "monthly_data":  monthly_data,
            "monthly_stats": monthly_stats,
            "yearly_data":   yearly_data,
            "yearly_stats":  yearly_stats,
        }

        # ── เชื่อมตารางสรุป: เติม cache แบบ write-through ใน background thread เสมอ ───
        # (ย้ายออกจาก request path ทั้งหมด — เดิมทำ 9 round-trip ไป Supabase แบบ synchronous
        # ทำให้ /api/health/summary ใช้เวลารวมเกือบ 9 วินาที จนเบราว์เซอร์ TimeoutError ที่ 15s
        # ตอนนี้ผู้ใช้ได้ผลลัพธ์ทันทีที่คำนวณเสร็จ ส่วนการเติม cache เกิดขึ้นทีหลังแบบไม่บล็อก response)
        month_total_cal = sum(float(e.calories) for e in month_entries)
        month_days = (today - first_of_month).days + 1
        threading.Thread(
            target=_sync_health_summary_cache,
            args=(
                user_id, last7days, dict(water_by_date),
                week_start.isoformat(), today.isoformat(), avg_calories_weekly,
                monthly_stats, first_of_month.isoformat(), month_total_cal, month_days,
            ),
            daemon=True,
        ).start()

        return result

    except Exception:
        _HEALTH_SUMMARY_LOGGER.exception("get_health_summary failed for user_id=%s — returning empty default", user_id)
        return _empty_health_summary(user_id)


def get_service_status() -> Dict[str, Any]:
    from services.rag_service import check_chroma_status

    status = {
        "status": "ok",
        "service": "NutriSmart AI Backend",
        "version": "1.0.0",
        "database": "ok",
        "model": "google/gemma-2-9b-it (RAG)",
        "ai_api_key_set": bool(settings.openrouter_api_key),
    }
    
    # Check Database
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:
        logging.getLogger("nutrismart.storage").exception("Database health check failed")
        status["status"] = "error"
        status["database"] = "error"
        status["database_error"] = "unavailable"

    # Check ChromaDB
    chroma_status = check_chroma_status()
    status["chromadb"] = chroma_status
    if chroma_status["status"] != "ok":
        status["status"] = "error"
        
    # Check API Key
    if not settings.openrouter_api_key:
        status["status"] = "error"
        status["ai_api_key_set"] = False
        
    return status
