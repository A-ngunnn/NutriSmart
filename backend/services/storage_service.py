import sqlite3
import uuid
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from config import get_settings

settings = get_settings()

DB_PATH = Path(settings.storage_db).resolve()

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT,
    age TEXT,
    gender TEXT,
    weight TEXT,
    height TEXT,
    activity_level TEXT,
    goal TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS food_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    total_fat REAL NOT NULL,
    sugar REAL NOT NULL,
    sodium REAL NOT NULL,
    score REAL NOT NULL,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

DEFAULT_USER_ID = "default"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_storage() -> None:
    with _connect() as conn:
        conn.executescript(CREATE_TABLES_SQL)
        conn.commit()


def _today_str() -> str:
    return date.today().isoformat()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}


def get_profile(user_id: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (user_id,)).fetchone()
        if row is None:
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
        return _row_to_dict(row)


def upsert_profile(user_id: Optional[str], profile_data: Dict[str, Any]) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    with _connect() as conn:
        existing = conn.execute("SELECT 1 FROM profiles WHERE id = ?", (user_id,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE profiles SET name = ?, age = ?, gender = ?, weight = ?, height = ?, activity_level = ?, goal = ?
                WHERE id = ?
                """,
                (
                    profile_data.get("name", ""),
                    profile_data.get("age", ""),
                    profile_data.get("gender", "male"),
                    profile_data.get("weight", ""),
                    profile_data.get("height", ""),
                    profile_data.get("activity_level", "sedentary"),
                    profile_data.get("goal", "maintain"),
                    user_id,
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO profiles (id, name, age, gender, weight, height, activity_level, goal, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    profile_data.get("name", ""),
                    profile_data.get("age", ""),
                    profile_data.get("gender", "male"),
                    profile_data.get("weight", ""),
                    profile_data.get("height", ""),
                    profile_data.get("activity_level", "sedentary"),
                    profile_data.get("goal", "maintain"),
                    now,
                ),
            )
        conn.commit()
    return get_profile(user_id)


def get_food_entries(user_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        query = "SELECT * FROM food_logs WHERE user_id = ?"
        params: List[Any] = [user_id]
        if start_date:
            query += " AND date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND date <= ?"
            params.append(end_date)
        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [_row_to_dict(row) for row in rows]


def insert_food_entry(user_id: Optional[str], entry: Dict[str, Any]) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    entry_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO food_logs (id, user_id, name, meal_type, calories, protein, carbs, fat, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id,
                user_id,
                entry["name"],
                entry["meal_type"],
                float(entry["calories"]),
                float(entry["protein"]),
                float(entry["carbs"]),
                float(entry["fat"]),
                entry.get("date", _today_str()),
                now,
            ),
        )
        conn.commit()
    return {"id": entry_id, "user_id": user_id, **entry, "date": entry.get("date", _today_str()), "created_at": now}


def delete_food_entry(user_id: Optional[str], entry_id: str) -> bool:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        result = conn.execute("DELETE FROM food_logs WHERE id = ? AND user_id = ?", (entry_id, user_id))
        conn.commit()
        return result.rowcount > 0


def get_water_entries(user_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        query = "SELECT * FROM water_logs WHERE user_id = ?"
        params: List[Any] = [user_id]
        if start_date:
            query += " AND date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND date <= ?"
            params.append(end_date)
        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [_row_to_dict(row) for row in rows]


def insert_water_entry(user_id: Optional[str], amount: float, entry_date: Optional[str] = None) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    entry_id = str(uuid.uuid4())
    entry_date = entry_date or _today_str()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO water_logs (id, user_id, amount, date, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (entry_id, user_id, float(amount), entry_date, now),
        )
        conn.commit()
    return {"id": entry_id, "user_id": user_id, "amount": float(amount), "date": entry_date, "created_at": now}


def delete_water_entry(user_id: Optional[str], entry_id: str) -> bool:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        result = conn.execute("DELETE FROM water_logs WHERE id = ? AND user_id = ?", (entry_id, user_id))
        conn.commit()
        return result.rowcount > 0


def get_scan_history(user_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    user_id = user_id or DEFAULT_USER_ID
    with _connect() as conn:
        query = "SELECT * FROM scan_history WHERE user_id = ? ORDER BY created_at DESC"
        params: List[Any] = [user_id]
        if limit:
            query += " LIMIT ?"
            params.append(limit)
        rows = conn.execute(query, params).fetchall()
        return [_row_to_dict(row) for row in rows]


def insert_scan_record(user_id: Optional[str], scan_data: Dict[str, Any]) -> Dict[str, Any]:
    user_id = user_id or DEFAULT_USER_ID
    now = datetime.utcnow().isoformat()
    record_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO scan_history (
                id, user_id, product_name, calories, protein, carbs, total_fat,
                sugar, sodium, score, status, date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                user_id,
                scan_data["product_name"],
                float(scan_data["calories"]),
                float(scan_data["protein"]),
                float(scan_data["carbs"]),
                float(scan_data["total_fat"]),
                float(scan_data["sugar"]),
                float(scan_data["sodium"]),
                float(scan_data["score"]),
                scan_data["status"],
                scan_data.get("date", _today_str()),
                now,
            ),
        )
        conn.commit()
    return {"id": record_id, "user_id": user_id, **scan_data, "date": scan_data.get("date", _today_str()), "created_at": now}


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
    status = {
        "status": "ok",
        "service": "NutriSmart AI Backend",
        "version": "1.0.0",
        "database": "ok",
        "model": settings.medgemma_model,
        "ai_api_key_set": bool(settings.medgemma_api_key),
    }
    try:
        with _connect() as conn:
            conn.execute("SELECT 1").fetchone()
    except Exception as exc:
        status["status"] = "error"
        status["database"] = "error"
        status["database_error"] = str(exc)
    if not settings.medgemma_api_key:
        status["status"] = "error"
        status["ai_api_key_set"] = False
    return status
