import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from config import get_settings
from database import SessionLocal, engine, Base
import models
from sqlalchemy import text

settings = get_settings()

DEFAULT_USER_ID = "default"


def initialize_storage() -> None:
    Base.metadata.create_all(bind=engine)


def _today_str() -> str:
    return date.today().isoformat()


def _model_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def get_profile(user_id: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        profile = db.query(models.Profile).filter(models.Profile.id == user_id).first()
        if profile is None:
            return {
                "id": user_id,
                "name": "",
                "age": "",
                "gender": "male",
                "weight": "",
                "height": "",
                "activity_level": "sedentary",
                "goal": "maintain",
            }
        return _model_to_dict(profile)


def upsert_profile(user_id: Optional[str], profile_data: Dict[str, Any]) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    with SessionLocal() as db:
        profile = db.query(models.Profile).filter(models.Profile.id == user_id).first()
        if profile:
            profile.name = profile_data.get("name", "")
            profile.age = profile_data.get("age", "")
            profile.gender = profile_data.get("gender", "male")
            profile.weight = profile_data.get("weight", "")
            profile.height = profile_data.get("height", "")
            profile.activity_level = profile_data.get("activity_level", "sedentary")
            profile.goal = profile_data.get("goal", "maintain")
        else:
            profile = models.Profile(
                id=user_id,
                name=profile_data.get("name", ""),
                age=profile_data.get("age", ""),
                gender=profile_data.get("gender", "male"),
                weight=profile_data.get("weight", ""),
                height=profile_data.get("height", ""),
                activity_level=profile_data.get("activity_level", "sedentary"),
                goal=profile_data.get("goal", "maintain"),
                created_at=now
            )
            db.add(profile)
        db.commit()
        db.refresh(profile)
        return _model_to_dict(profile)


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


def insert_food_entry(user_id: Optional[str], entry: Dict[str, Any]) -> Dict[str, Any]:
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

    # ── Sodium Auto-Trigger ───────────────────────────────────────────────────
    # ตรวจสอบโซเดียมรวมจาก ScanHistory ของวันนี้ แล้วแจ้งเตือนถ้าเกินเกณฑ์
    _check_sodium_and_notify(user_id, entry_date)

    return result


# ── Sodium Auto-Trigger Helper ───────────────────────────────────────────────
SODIUM_DAILY_LIMIT_MG = 2_000.0

def _check_sodium_and_notify(user_id: str, check_date: str) -> None:
    """
    คำนวณโซเดียมรวมจาก ScanHistory ของวันที่ระบุ
    ถ้าเกิน 2,000 mg → INSERT notification เตือน (ไม่เตือนซ้ำวันเดียวกัน)
    """
    try:
        with SessionLocal() as db:
            # คำนวณโซเดียมรวมจาก scan_history วันนี้
            scans = (
                db.query(models.ScanHistory)
                .filter(
                    models.ScanHistory.user_id == user_id,
                    models.ScanHistory.date == check_date,
                )
                .all()
            )
            total_sodium = sum(float(s.sodium or 0) for s in scans)

            if total_sodium < SODIUM_DAILY_LIMIT_MG:
                return  # ยังไม่เกินเกณฑ์ ไม่ต้องแจ้งเตือน

            # ── เช็ก Dedup: ถ้าวันนี้เคยแจ้งเตือนโซเดียมไปแล้ว ข้ามได้เลย ──
            already_notified = (
                db.query(models.Notification)
                .filter(
                    models.Notification.user_id == user_id,
                    models.Notification.category == "goal",
                    models.Notification.title.like("%โซเดียม%"),
                    models.Notification.created_at >= check_date,  # วันเดียวกัน
                )
                .first()
            )
            if already_notified:
                return  # เคยเตือนไปแล้ววันนี้

            # ── INSERT notification ──────────────────────────────────────────
            nid = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            notif_title = "⚠️ โซเดียมเกินเกณฑ์วันนี้!"
            notif_body = (
                f"วันนี้คุณได้รับโซเดียมสะสม {total_sodium:.0f} mg "
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

            # ── ส่ง LINE Push (fire-and-forget, non-blocking) ────────────────
            try:
                import asyncio
                from services.line_service import send_line_if_available
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(
                        send_line_if_available(
                            user_id=user_id,
                            title=notif_title,
                            body=notif_body,
                            emoji="🧂",
                            category="goal",
                            priority="high",
                        )
                    )
            except Exception as line_exc:
                logging.getLogger("nutrismart.storage").warning(
                    "[LINE] Sodium LINE push failed (non-fatal): %s", line_exc
                )

    except Exception as exc:
        # ไม่ให้ error ของ notification ทำให้ food log พัง
        import logging
        logging.getLogger("nutrismart.storage").warning(
            "Sodium notify error (non-fatal): %s", exc
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


def insert_water_entry(user_id: Optional[str], amount: float, entry_date: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    entry_id = str(uuid.uuid4())
    entry_date = entry_date or _today_str()
    with SessionLocal() as db:
        new_entry = models.WaterLog(
            id=entry_id,
            user_id=user_id,
            amount=float(amount),
            date=entry_date,
            created_at=now
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        return _model_to_dict(new_entry)


def delete_water_entry(user_id: Optional[str], entry_id: str) -> bool:
    user_id = user_id or DEFAULT_USER_ID
    with SessionLocal() as db:
        entry = db.query(models.WaterLog).filter(models.WaterLog.id == entry_id, models.WaterLog.user_id == user_id).first()
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


def insert_scan_record(user_id: Optional[str], scan_data: Dict[str, Any]) -> Dict[str, Any]:
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
            date=entry_date,
            created_at=now
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return _model_to_dict(new_record)


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
    return int(round(tdee))


def _water_target(profile: Dict[str, Any]) -> int:
    try:
        weight = float(profile.get("weight") or 0)
    except (ValueError, TypeError):
        return 2000
    return int(round(weight * 33)) if weight > 0 else 2000


def get_dashboard_summary(user_id: Optional[str] = None) -> Dict[str, Any]:
    profile = get_profile(user_id)
    today = _today_str()
    food_entries = get_food_entries(user_id, start_date=today, end_date=today)
    scan_history = get_scan_history(user_id)
    water_entries = get_water_entries(user_id, start_date=today, end_date=today)

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
        "scan_count": len(scan_history),
        "water_today": int(round(sum(float(item["amount"]) for item in water_entries))),
        "water_target": _water_target(profile),
        "meal_totals": meal_totals,
    }


def get_health_summary(user_id: Optional[str] = None) -> Dict[str, Any]:
    profile = get_profile(user_id)
    tdee = _calc_tdee(profile)
    end = date.today()
    start = end - timedelta(days=6)
    start_iso = start.isoformat()
    end_iso = end.isoformat()

    entries = get_food_entries(user_id, start_date=start_iso, end_date=end_iso)
    scan_history = get_scan_history(user_id)

    last7days = []
    for idx in range(6, -1, -1):
        current = end - timedelta(days=idx)
        date_str = current.isoformat()
        label = current.strftime("%a")
        day_entries = [item for item in entries if item["date"] == date_str]
        last7days.append({
            "date": date_str,
            "label": label,
            "calories": int(round(sum(float(item["calories"]) for item in day_entries))),
            "protein": int(round(sum(float(item["protein"]) for item in day_entries))),
            "carbs": int(round(sum(float(item["carbs"]) for item in day_entries))),
            "fat": int(round(sum(float(item["fat"]) for item in day_entries))),
        })

    total_macros = {
        "protein": int(round(sum(day["protein"] for day in last7days))),
        "carbs": int(round(sum(day["carbs"] for day in last7days))),
        "fat": int(round(sum(day["fat"] for day in last7days))),
    }

    avg_calories = int(round(sum(day["calories"] for day in last7days) / 7))
    avg_score = int(round(sum(float(item["score"]) for item in scan_history) / len(scan_history))) if scan_history else 0

    return {
        "profile": profile,
        "tdee": tdee,
        "last_7_days": last7days,
        "avg_calories": avg_calories,
        "avg_scan_score": avg_score,
        "scan_count": len(scan_history),
        "macro_totals": total_macros,
        "scan_history": scan_history,
    }


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
        status["status"] = "error"
        status["database"] = "error"
        status["database_error"] = str(exc)
        
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
