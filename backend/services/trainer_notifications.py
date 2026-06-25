"""
Trainer Notifications – core logic shared by:
  1) routers/notifications.py  (HTTP trigger-summary/* and trigger-reminder endpoints — manual/demo calls)
  2) services/notification_scheduler.py (background asyncio loop — automatic production calls)

แยกออกมาจาก routers/notifications.py เพื่อให้ scheduler เรียกใช้ตรรกะเดียวกันได้โดยไม่ต้องผ่าน
HTTP request / FastAPI Depends(get_current_user) ซึ่ง scheduler ไม่มี request ให้ depend บน
"""

import logging
import random
from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException

from database import SessionLocal
import models
from services.storage_service import insert_notification, get_profile, get_health_summary, _calc_tdee, SODIUM_DAILY_LIMIT_MG
from services.fcm_service import send_push_if_available
from services.ai_service import call_medgemma
from services.rag_service import get_relevant_context

logger = logging.getLogger("nutrismart.trainer_notifications")

# ── Constants ────────────────────────────────────────────────────────────────

_RDI_RULER = (
    "พลังงานเฉลี่ย 2,000 kcal/วัน | โปรตีน 50 กรัม | คาร์โบไฮเดรต 300 กรัม | "
    "ไขมันทั้งหมด 65 กรัม | น้ำตาล ไม่เกิน 24 กรัม | โซเดียม ไม่เกิน 2,000 มิลลิกรัม "
    "(เกณฑ์ Thai RDI โดยกองโภชนาการ กรมอนามัย — ปรับลดลงตามความเหมาะสมหากมีโรคประจำตัว)"
)
_DISCLAIMER = " (ข้อมูลนี้เป็นคำแนะนำทั่วไปจากเทรนเนอร์ ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีอาการผิดปกติควรพบแพทย์)"

WEEKLY_TITLE = "รายงานสุขภาพประจำสัปดาห์จากเทรนเนอร์ 📊"
MONTHLY_TITLE = "รายงานแนวโน้มสุขภาพประจำเดือนจากเทรนเนอร์ 📅"
YEARLY_TITLE = "รายงานแนวโน้มสุขภาพประจำปีจากเทรนเนอร์ 🗓️"
REMINDER_TITLE = "เทรนเนอร์มาตามจิกแล้วนะ! 👀"
GOAL_RECAP_TITLE = "วันนี้ทำได้ตามเป้าหมายแคลอรี! 🎯"
SODIUM_GOOD_DAY_TITLE = "วันนี้ควบคุมโซเดียมได้ดีมาก! 🧂✅"
WELCOME_BACK_TITLE = "ยินดีต้อนรับกลับมา! 🌟"
STREAK_MILESTONES = (3, 7, 14, 30, 60, 100)
SODIUM_GOOD_DAY_RATIO = 0.7  # ถือว่า "ควบคุมได้ดี" ถ้าโซเดียมรวมไม่เกิน 70% ของเกณฑ์ Thai RDI

_REMINDER_TEMPLATES = [
    "สวัสดีครับลูกเทรน! วันนี้อย่าลืมแวะเข้ามาอัปเดตบันทึกอาหารและปริมาณน้ำดื่มให้เทรนเนอร์เช็คฟอร์มด้วยนะครับ เพื่อสุขภาพที่ดีของเราลุยกันต่อ! 🔥",
    "เฮ้ยลูกเทรน หายไปไหนมา? เทรนเนอร์รอดูบันทึกอาหารวันนี้อยู่นะ มาอัปเดตหน่อยให้เทรนเนอร์ช่วยเช็คฟอร์มให้ดิ! 💪",
    "ลูกเทรนจ๋า วันนี้ยังไม่เห็นมาบันทึกอาหาร/น้ำเลยนะ เทรนเนอร์เป็นห่วง รีบแวะมาอัปเดตหน่อย จะได้ไม่หลุดเป้าหมาย! 🥗💧",
    "เช็คอินหน่อยลูกเทรน! วันนี้กินอะไรไปบ้าง ดื่มน้ำครบไหม มาบอกเทรนเนอร์ให้ไวเลย จะได้ปรับแผนให้ทันท่วงที 🏋️‍♂️",
]


def _today_str() -> str:
    return date.today().isoformat()


# ── Dual-channel dispatch (Web Bell 🔔 + FCM Web Push 📲) ────────────────────

async def notify_dual_channel(
    user_id: str,
    title: str,
    body: str,
    emoji: str,
    category: str = "ai",
    priority: str = "medium",
) -> models.Notification:
    """
    บันทึกแจ้งเตือนลง DB ทันที (หน้าเว็บดึงไปแสดงที่กระดิ่ง) แล้ว await ส่ง Web Push ผ่าน FCM
    (send_push_if_available ไม่ raise exception เด็ดขาด จึงปลอดภัยที่จะ await ตรงๆ ได้เสมอ
    ไม่ว่าจะเรียกจาก HTTP endpoint หรือ scheduler ที่ไม่มี BackgroundTasks ให้ใช้)
    """
    notif = insert_notification(
        user_id=user_id, category=category, priority=priority,
        title=title, body=body, emoji=emoji,
    )
    try:
        await send_push_if_available(
            user_id=user_id, title=title, body=body,
            emoji=emoji, category=category, priority=priority,
        )
    except Exception:
        logger.warning("FCM push failed for user_id=%s (non-fatal)", user_id, exc_info=True)
    return notif


# ── Helpers: Personal Trainer prompt building (RAG-grounded) ────────────────

def _build_rag_query(chronic_disease: str, avg_pro: float, avg_carb: float, avg_fat: float) -> str:
    parts: List[str] = []
    if chronic_disease:
        parts.append(chronic_disease)
    if avg_pro < 50:
        parts.append("โปรตีนต่ำ")
    if avg_carb > 300:
        parts.append("คาร์โบไฮเดรตสูง น้ำตาลสูง")
    if avg_fat > 65:
        parts.append("ไขมันสูง ไขมันอิ่มตัว")
    if not parts:
        parts.append("Thai RDI โภชนาการพื้นฐาน")
    return " ".join(parts)


def _build_rag_query_calories_only(chronic_disease: str, avg_calories: float) -> str:
    parts: List[str] = []
    if chronic_disease:
        parts.append(chronic_disease)
    if avg_calories > 2000:
        parts.append("แคลอรีเกิน กินเกิน")
    elif 0 < avg_calories < 1500:
        parts.append("แคลอรีต่ำ กินขาด")
    if not parts:
        parts.append("Thai RDI โภชนาการพื้นฐาน")
    return " ".join(parts)


def _get_rag_context(query: str) -> str:
    try:
        ctx = get_relevant_context(query, max_items=4)
    except Exception:
        logger.warning("RAG context retrieval failed for trainer summary (non-fatal)", exc_info=True)
        ctx = "ไม่มีข้อมูลอ้างอิง"
    if not ctx or ctx == "ไม่มีข้อมูลอ้างอิง":
        ctx = _RDI_RULER
    return ctx


def _trend_direction(values: List[float]) -> str:
    nz = [v for v in values if v > 0]
    if len(nz) < 2:
        return "ยังไม่มีข้อมูลพอจะบอกแนวโน้มได้ชัดเจน"
    mid = len(nz) // 2
    first_half = nz[:mid] or nz[:1]
    second_half = nz[mid:] or nz[-1:]
    avg1 = sum(first_half) / len(first_half)
    avg2 = sum(second_half) / len(second_half)
    diff_pct = ((avg2 - avg1) / avg1 * 100) if avg1 else 0
    if diff_pct > 8:
        return f"แคลอรีมีแนวโน้ม 'เพิ่มขึ้น' ประมาณ {diff_pct:.0f}% เมื่อเทียบช่วงต้นกับช่วงหลังของรอบนี้"
    if diff_pct < -8:
        return f"แคลอรีมีแนวโน้ม 'ลดลง' ประมาณ {abs(diff_pct):.0f}% เมื่อเทียบช่วงต้นกับช่วงหลังของรอบนี้"
    return "แคลอรีค่อนข้างทรงตัว ไม่มีแนวโน้มขึ้นหรือลงชัดเจนในรอบนี้"


def _build_trainer_prompt(
    period_label: str,
    disease_line: str,
    stats_text: str,
    avg_summary_line: str,
    trend_note: str,
    rag_context: str,
) -> str:
    return f"""คุณคือ "เทรนเนอร์ส่วนตัวคู่ใจชาวไทย (Personal Trainer)" ของแอป NutriSmart บุคลิกเป็นกันเอง กระตือรือร้น ห่วงใยลูกเทรนเหมือนโค้ชที่ดูแลนักกีฬาตัวเอง
กฎการเรียกชื่อ: เรียกผู้ใช้ว่า "ลูกเทรน" เสมอ และเรียกแทนตัวเองว่า "เทรนเนอร์" ห้ามใช้คำว่า "คนไข้" หรือน้ำเสียงคุณหมอเด็ดขาด

หน้าที่ของคุณคือวิเคราะห์สถิติการกินของลูกเทรนใน{period_label} โดยต้อง "เปรียบเทียบกับเกณฑ์ Thai RDI" และ "พิจารณาโรคประจำตัว" อย่างเจาะจง ห้ามตอบกว้างๆทั่วไป

── โรคประจำตัวของลูกเทรน ──
{disease_line}

── สถิติการกินใน{period_label} ──
{stats_text}

── สรุปค่าเฉลี่ย ──
{avg_summary_line}

── แนวโน้ม (Trend) ในรอบนี้ ──
{trend_note}

── เกณฑ์อ้างอิง Thai RDI (กองโภชนาการ กรมอนามัย) ──
{_RDI_RULER}

── บริบทความรู้ที่เกี่ยวข้อง (ค้นจากคลังความรู้โภชนาการไทย) ──
{rag_context}

── สิ่งที่ต้องทำ ──
1. ชม "จุดเด่นที่ทำได้ดี" ของลูกเทรนก่อน 1 ประเด็น (หาแง่บวกจากตัวเลขเสมอ แม้ภาพรวมจะยังไม่ดีก็ตาม)
2. ตักเตือนจุดที่กิน "เกินหรือขาด" เกณฑ์ Thai RDI อย่างตรงไปตรงมาแบบเทรนเนอร์ พร้อมระบุตัวเลขจริง
3. ถ้ามีโรคประจำตัว ให้เชื่อมโยงพฤติกรรมการกินกับความเสี่ยงของโรคนั้นโดยตรง โดยอ้างอิงบริบทความรู้ข้างต้น
4. พูดถึงแนวโน้ม (Trend) สั้นๆ ว่าลูกเทรนกำลังไปทางที่ดีขึ้นหรือต้องเร่งปรับ
5. ปิดท้ายด้วยคำให้กำลังใจสไตล์เทรนเนอร์ยิม กระตุ้นให้ลุยต่อ (เช่น "สู้ๆนะลูกเทรน!", "เทรนเนอร์เชื่อว่าทำได้!")
6. ห้ามใส่หัวข้อหรือสัญลักษณ์ Markdown ตอบเป็นข้อความธรรมดาเท่านั้น (จะถูกส่งไปแสดงในแอปและ LINE)
7. ความยาวรวมไม่เกิน 5 ประโยค เพื่อให้อ่านจบไวบนมือถือ"""


async def _generate_trainer_summary(prompt: str, fallback_text: str) -> str:
    try:
        text = await call_medgemma(prompt)
        text = text.strip().replace("**", "").replace("##", "").strip()
        if len(text) > 260:
            text = text[:257] + "..."
    except HTTPException:
        text = fallback_text
    return text + _DISCLAIMER


def _no_data_message(period_label: str) -> str:
    return f"ลูกเทรนยังไม่มีข้อมูลการกินใน{period_label}เลยนะ ลองแวะมาบันทึกอาหารหน่อย เทรนเนอร์อยากเช็คฟอร์มลูกเทรนจะแย่แล้ว! 🏋️"


# ── Reminder helper ──────────────────────────────────────────────────────────

def has_logged_today(user_id: str) -> bool:
    """เช็กว่าลูกเทรนบันทึกอาหารหรือน้ำดื่มของวันนี้ไปแล้วหรือยัง"""
    today = _today_str()
    with SessionLocal() as db:
        has_food = db.query(models.FoodLog).filter(
            models.FoodLog.user_id == user_id, models.FoodLog.date == today,
        ).first() is not None
        if has_food:
            return True
        has_water = db.query(models.WaterLog).filter(
            models.WaterLog.user_id == user_id, models.WaterLog.date == today,
        ).first() is not None
        return has_water


# ── High-level orchestration (shared by HTTP router + scheduler) ────────────

async def run_weekly_summary(user_id: str) -> models.Notification:
    summary = get_health_summary(user_id)
    last7 = summary["last_7_days"]
    has_data = any(d["calories"] > 0 for d in last7) or summary["scan_count"] > 0

    if not has_data:
        return await notify_dual_channel(
            user_id, "ยังไม่มีข้อมูล 7 วันที่ผ่านมา 📊", _no_data_message("สัปดาห์นี้"), "📊",
        )

    profile = get_profile(user_id)
    chronic_disease = str(profile.get("chronic_disease") or "").strip()
    disease_line = chronic_disease if chronic_disease else "ไม่มีโรคประจำตัวที่ระบุไว้"

    mt = summary["macro_totals"]
    avg_pro, avg_carb, avg_fat = mt["protein"] / 7, mt["carbs"] / 7, mt["fat"] / 7
    avg_cal = summary["avg_calories"]

    stats_text = "\n".join(
        f"  {d['label']} ({d['date']}): แคลอรี {d['calories']} kcal | โปรตีน {d['protein']}g | คาร์บ {d['carbs']}g | ไขมัน {d['fat']}g"
        for d in last7
    )
    avg_summary_line = (
        f"แคลอรีเฉลี่ย {avg_cal} kcal/วัน | โปรตีนเฉลี่ย {avg_pro:.1f}g/วัน | "
        f"คาร์บเฉลี่ย {avg_carb:.1f}g/วัน | ไขมันเฉลี่ย {avg_fat:.1f}g/วัน | "
        f"คะแนนสแกนเฉลี่ย {summary['avg_scan_score']} | สแกน/บันทึกไปแล้ว {summary['scan_count']} รายการ"
    )
    trend_note = _trend_direction([d["calories"] for d in last7])

    rag_query = _build_rag_query(chronic_disease, avg_pro, avg_carb, avg_fat)
    rag_context = _get_rag_context(rag_query)

    prompt = _build_trainer_prompt("สัปดาห์นี้ (7 วันล่าสุด)", disease_line, stats_text, avg_summary_line, trend_note, rag_context)
    fallback = (
        f"สัปดาห์นี้ลูกเทรนทานแคลอรีเฉลี่ย {avg_cal:.0f} kcal/วัน "
        f"โปรตีน {avg_pro:.0f}g และไขมัน {avg_fat:.0f}g ต่อวัน "
        f"(เทียบเกณฑ์ Thai RDI: 2,000 kcal | โปรตีน 50g | ไขมัน 65g) สู้ๆต่อไปนะลูกเทรน เทรนเนอร์เป็นกำลังใจให้! 💪"
    )
    ai_summary = await _generate_trainer_summary(prompt, fallback)
    return await notify_dual_channel(user_id, WEEKLY_TITLE, ai_summary, "📊")


async def run_monthly_summary(user_id: str) -> models.Notification:
    summary = get_health_summary(user_id)
    monthly_data = summary["monthly_data"]
    monthly_stats = summary["monthly_stats"]
    has_data = any(w["cal"] > 0 for w in monthly_data) or monthly_stats["scan_count"] > 0

    if not has_data:
        return await notify_dual_channel(
            user_id, "ยังไม่มีข้อมูลเดือนนี้ 📅", _no_data_message("เดือนนี้"), "📅",
        )

    profile = get_profile(user_id)
    chronic_disease = str(profile.get("chronic_disease") or "").strip()
    disease_line = chronic_disease if chronic_disease else "ไม่มีโรคประจำตัวที่ระบุไว้"

    stats_text = "\n".join(f"  {w['week']}: แคลอรีเฉลี่ย {w['cal']} kcal/วัน" for w in monthly_data)
    avg_summary_line = (
        f"แคลอรีเฉลี่ยทั้งเดือน {monthly_stats['avg_calories']} kcal/วัน | "
        f"คะแนนสแกนเฉลี่ย {monthly_stats['avg_scan_score']} | สแกน/บันทึกไปแล้ว {monthly_stats['scan_count']} รายการ"
    )
    trend_note = _trend_direction([w["cal"] for w in monthly_data])

    rag_query = _build_rag_query_calories_only(chronic_disease, monthly_stats["avg_calories"])
    rag_context = _get_rag_context(rag_query)

    prompt = _build_trainer_prompt("เดือนนี้ (แยกเป็นรายสัปดาห์)", disease_line, stats_text, avg_summary_line, trend_note, rag_context)
    fallback = (
        f"เดือนนี้ลูกเทรนทานแคลอรีเฉลี่ย {monthly_stats['avg_calories']} kcal/วัน "
        f"(เทียบเกณฑ์ Thai RDI: 2,000 kcal/วัน) ลุยต่อให้สม่ำเสมอนะลูกเทรน เทรนเนอร์เชื่อว่าทำได้! 🔥"
    )
    ai_summary = await _generate_trainer_summary(prompt, fallback)
    return await notify_dual_channel(user_id, MONTHLY_TITLE, ai_summary, "📅")


async def run_yearly_summary(user_id: str) -> models.Notification:
    summary = get_health_summary(user_id)
    yearly_data = summary["yearly_data"]
    yearly_stats = summary["yearly_stats"]
    has_data = any(m["cal"] > 0 for m in yearly_data) or yearly_stats["scan_count"] > 0

    if not has_data:
        return await notify_dual_channel(
            user_id, "ยังไม่มีข้อมูลปีนี้ 🗓️", _no_data_message("ปีนี้"), "🗓️",
        )

    profile = get_profile(user_id)
    chronic_disease = str(profile.get("chronic_disease") or "").strip()
    disease_line = chronic_disease if chronic_disease else "ไม่มีโรคประจำตัวที่ระบุไว้"

    stats_text = "\n".join(f"  {m['month']}: แคลอรีเฉลี่ย {m['cal']} kcal/วัน" for m in yearly_data)
    avg_summary_line = (
        f"แคลอรีเฉลี่ยทั้งปี {yearly_stats['avg_calories']} kcal/วัน | "
        f"คะแนนสแกนเฉลี่ย {yearly_stats['avg_scan_score']} | สแกน/บันทึกไปแล้ว {yearly_stats['scan_count']} รายการ"
    )
    trend_note = _trend_direction([m["cal"] for m in yearly_data])

    rag_query = _build_rag_query_calories_only(chronic_disease, yearly_stats["avg_calories"])
    rag_context = _get_rag_context(rag_query)

    prompt = _build_trainer_prompt("ปีนี้ (แยกเป็นรายเดือน 12 เดือนล่าสุด)", disease_line, stats_text, avg_summary_line, trend_note, rag_context)
    fallback = (
        f"ปีนี้ลูกเทรนทานแคลอรีเฉลี่ย {yearly_stats['avg_calories']} kcal/วัน "
        f"(เทียบเกณฑ์ Thai RDI: 2,000 kcal/วัน) ภาพรวมทั้งปีถือว่าน่าชม ลุยต่อปีหน้าให้ดีกว่านี้นะลูกเทรน! 🎉"
    )
    ai_summary = await _generate_trainer_summary(prompt, fallback)
    return await notify_dual_channel(user_id, YEARLY_TITLE, ai_summary, "🗓️")


async def run_daily_reminder(user_id: str, force: bool = False) -> Optional[models.Notification]:
    """คืน None ถ้าไม่ส่ง (เพราะบันทึกข้อมูลวันนี้ไปแล้วและ force=False)"""
    if not force and has_logged_today(user_id):
        return None
    reminder_text = random.choice(_REMINDER_TEMPLATES)
    return await notify_dual_channel(user_id, REMINDER_TITLE, reminder_text, "🔔", "daily", "medium")


# ── Positive reinforcement: ตอนนี้ระบบมีแต่แจ้งเตือนเชิงลบ (เกินเกณฑ์) อย่างเดียว ──

async def run_daily_goal_recap(user_id: str) -> Optional[models.Notification]:
    """ส่งช่วงท้ายวัน (ดูจาก notification_scheduler) ถ้าวันนี้บันทึกอาหารแล้วและแคลอรีรวมยังอยู่
    ในเป้าหมาย — ให้กำลังใจ ไม่ใช่จับผิดอย่างเดียว"""
    today = _today_str()
    with SessionLocal() as db:
        rows = db.query(models.FoodLog.calories).filter(
            models.FoodLog.user_id == user_id, models.FoodLog.date == today,
        ).all()
        if not rows:
            return None
        total_calories = sum(float(r[0] or 0) for r in rows)

    profile = get_profile(user_id)
    tdee = _calc_tdee(profile) or 2000
    if total_calories <= 0 or total_calories > tdee:
        return None

    body = (
        f"เยี่ยมมาก! วันนี้คุณทานไป {total_calories:.0f} kcal ยังอยู่ในเป้าหมาย {tdee:.0f} kcal/วัน "
        "รักษาพฤติกรรมการกินดีๆ แบบนี้ไว้ต่อไปนะคะ 💚"
    )
    return await notify_dual_channel(user_id, GOAL_RECAP_TITLE, body, "🎯", "goal", "medium")


async def run_sodium_good_day(user_id: str) -> Optional[models.Notification]:
    """เดิมโซเดียมมีแต่แจ้งเตือนตอน 'เกิน' อย่างเดียว ไม่มีฝั่งชมเลยตอนคุมได้ดี — เติมส่วนนี้ให้สมดุล
    ส่งช่วงท้ายวัน ถ้าวันนี้สแกน/บันทึกแล้วและโซเดียมรวมยังต่ำกว่า 70% ของเกณฑ์ Thai RDI"""
    today = _today_str()
    with SessionLocal() as db:
        rows = db.query(models.ScanHistory.sodium).filter(
            models.ScanHistory.user_id == user_id, models.ScanHistory.date == today,
        ).all()
        if not rows:
            return None
        total_sodium = sum(float(r[0] or 0) for r in rows)

    if total_sodium <= 0 or total_sodium > SODIUM_DAILY_LIMIT_MG * SODIUM_GOOD_DAY_RATIO:
        return None

    body = (
        f"เยี่ยมมาก! วันนี้คุณได้รับโซเดียมรวม {total_sodium:.0f} mg เท่านั้น ต่ำกว่าเกณฑ์แนะนำ "
        f"{SODIUM_DAILY_LIMIT_MG:.0f} mg/วัน มากเลย ร่างกายขอบคุณนะคะ 🧂✅"
    )
    return await notify_dual_channel(user_id, SODIUM_GOOD_DAY_TITLE, body, "🧂", "goal", "low")


def _current_logging_streak(user_id: str) -> int:
    """นับจำนวนวันติดต่อกันที่บันทึกอาหาร นับถอยจากวันนี้"""
    with SessionLocal() as db:
        logged_dates = {
            r[0] for r in db.query(models.FoodLog.date).filter(models.FoodLog.user_id == user_id).distinct().all()
        }
    streak = 0
    cursor = date.today()
    while cursor.isoformat() in logged_dates:
        streak += 1
        cursor = cursor.fromordinal(cursor.toordinal() - 1)
    return streak


async def run_streak_check(user_id: str) -> Optional[models.Notification]:
    """ถ้า streak การบันทึกอาหารวันนี้ตรงกับ milestone (3/7/14/30/60/100 วัน) → ส่งแจ้งเตือนยินดีด้วย"""
    streak = _current_logging_streak(user_id)
    if streak not in STREAK_MILESTONES:
        return None
    title = f"ต่อเนื่อง {streak} วันแล้ว! 🔥"
    body = f"คุณบันทึกอาหารต่อเนื่องมา {streak} วันแล้ว สุดยอดความสม่ำเสมอ! เทรนเนอร์ภูมิใจในตัวคุณมากเลยนะคะ 🎉"
    return await notify_dual_channel(user_id, title, body, "🔥", "daily", "medium")


# ── On-demand AI Health Insights (หน้า "วิเคราะห์สุขภาพ") ────────────────────
# ต่างจาก buildInsights() เดิมฝั่ง frontend ที่เป็น if/else เทียบตัวเลขกับแม่แบบประโยคตายตัว —
# อันนี้เรียก MedGemma จริง พร้อม RAG context จากคลังความรู้ Thai RDI ให้วิเคราะห์ตามบริบทจริงของ
# คนนั้น (โรคประจำตัว, สัดส่วนมาโคร, แนวโน้ม) ไม่ใช่แค่ if-else เทียบ threshold
_FALLBACK_AI_INSIGHTS = [
    "ยังไม่มีข้อมูลพอให้ AI วิเคราะห์เชิงลึกได้ ลองบันทึกอาหารหรือสแกนฉลากต่อเนื่องอีกสักหน่อยนะคะ",
]

_PERIOD_LABELS = {"weekly": "สัปดาห์นี้", "monthly": "เดือนนี้", "yearly": "ปีนี้"}


def _build_insights_prompt(
    period_label: str, disease_line: str, stats_text: str, trend_note: str, rag_context: str,
) -> str:
    return f"""คุณคือ "เทรนเนอร์ส่วนตัวคู่ใจชาวไทย" ของแอป NutriSmart วิเคราะห์ข้อมูลโภชนาการของลูกเทรนใน{period_label}
เรียกผู้ใช้ว่า "ลูกเทรน" เสมอ ห้ามใช้น้ำเสียงคุณหมอ

── โรคประจำตัวของลูกเทรน ──
{disease_line}

── สถิติการกินใน{period_label} ──
{stats_text}

── แนวโน้ม (Trend) ──
{trend_note}

── เกณฑ์อ้างอิง Thai RDI ──
{_RDI_RULER}

── บริบทความรู้ที่เกี่ยวข้อง ──
{rag_context}

── สิ่งที่ต้องทำ ──
วิเคราะห์แล้วตอบเป็น insight สั้นๆ 3-4 ข้อ (ไม่ใช่บทความยาว) โดย:
1. ข้อแรก ต้องชมจุดที่ทำได้ดี (หาแง่บวกจากตัวเลขจริงเสมอ)
2. มีอย่างน้อย 1 ข้อที่เจาะจงเชื่อมโยงกับโรคประจำตัว (ถ้ามี) หรือสัดส่วนมาโครที่ผิดเกณฑ์
3. มีข้อเสนอแนะที่ทำได้จริงอย่างน้อย 1 ข้อ (ระบุอาหาร/พฤติกรรมที่เจาะจง ไม่พูดกว้างๆ)
4. แต่ละข้อให้ขึ้นต้นบรรทัดด้วย "- " เท่านั้น ห้ามมีคำนำ คำลงท้าย หรือ Markdown อื่นๆ
5. แต่ละข้อยาวไม่เกิน 1 ประโยค สั้น กระชับ อ่านจบไวบนมือถือ"""


async def generate_ai_health_insights(user_id: str, period: str) -> List[str]:
    """เรียก AI วิเคราะห์ insight สุขภาพแบบเข้าใจบริบทจริง (โรคประจำตัว + RAG) ไม่ใช่แค่เทียบ template
    period: 'weekly' | 'monthly' | 'yearly'"""
    summary = get_health_summary(user_id)
    profile = summary.get("profile") or {}
    chronic_disease = str(profile.get("chronic_disease") or "")
    disease_line = chronic_disease or "ไม่มีโรคประจำตัวที่ระบุไว้"

    period_label = _PERIOD_LABELS.get(period, "สัปดาห์นี้")
    mt = summary.get("macro_totals") or {"protein": 0, "carbs": 0, "fat": 0}
    tdee = float(summary.get("tdee") or 2000)

    if period == "monthly":
        stats = summary.get("monthly_stats") or {}
        trend_values = [float(w.get("cal") or 0) for w in (summary.get("monthly_data") or [])]
    elif period == "yearly":
        stats = summary.get("yearly_stats") or {}
        trend_values = [float(m.get("cal") or 0) for m in (summary.get("yearly_data") or [])]
    else:
        stats = {"avg_calories": summary.get("avg_calories", 0), "scan_count": summary.get("scan_count", 0)}
        trend_values = [float(d.get("calories") or 0) for d in (summary.get("last_7_days") or [])]

    avg_cal = float(stats.get("avg_calories") or 0)
    scan_count = int(stats.get("scan_count") or 0)

    if avg_cal <= 0 and scan_count <= 0:
        return _FALLBACK_AI_INSIGHTS

    stats_text = (
        f"แคลอรีเฉลี่ย {avg_cal:.0f} kcal/วัน (เป้าหมาย TDEE {tdee:.0f} kcal) | "
        f"โปรตีนรวม {float(mt.get('protein') or 0):.0f}g คาร์บรวม {float(mt.get('carbs') or 0):.0f}g "
        f"ไขมันรวม {float(mt.get('fat') or 0):.0f}g | สแกน/บันทึกไปแล้ว {scan_count} รายการ"
    )
    trend_note = _trend_direction(trend_values)
    rag_query = _build_rag_query(chronic_disease, float(mt.get('protein') or 0), float(mt.get('carbs') or 0), float(mt.get('fat') or 0))
    rag_context = _get_rag_context(rag_query)

    prompt = _build_insights_prompt(period_label, disease_line, stats_text, trend_note, rag_context)

    try:
        text = await call_medgemma(prompt)
    except HTTPException:
        return _FALLBACK_AI_INSIGHTS

    lines = [
        line.strip().lstrip("-•*").strip()
        for line in text.replace("**", "").split("\n")
        if line.strip() and line.strip() not in ("-", "•", "*")
    ]
    return lines[:5] if lines else _FALLBACK_AI_INSIGHTS
