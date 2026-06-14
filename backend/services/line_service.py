"""
LINE Messaging Service – NutriSmart
ส่งข้อความ Push Message ไปยังแอป LINE ของผู้ใช้ผ่าน LINE Messaging API

การตั้งค่าที่ต้องการ:
  LINE_CHANNEL_ACCESS_TOKEN = <long-lived channel access token จาก LINE Developers Console>

อ้างอิง:
  https://developers.line.biz/en/reference/messaging-api/#send-push-message
"""

import logging
from typing import Optional

import httpx

from config import get_settings

settings = get_settings()
logger = logging.getLogger("nutrismart.line_service")

# ── LINE API Constants ────────────────────────────────────────────────────────
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
LINE_TIMEOUT_SEC = 15.0

# ── NutriSmart Brand Colors (สำหรับ Flex Message) ────────────────────────────
_BRAND_GREEN = "#1D9E75"
_WARN_AMBER = "#F59E0B"
_DANGER_RED = "#EF4444"
_AI_PURPLE = "#8B5CF6"

_CATEGORY_COLOR = {
    "daily": "#0EA5E9",
    "goal": _WARN_AMBER,
    "ai": _AI_PURPLE,
    "system": "#64748B",
}

_PRIORITY_ICON = {
    "high":   "⚠️",
    "medium": "📌",
    "low":    "💬",
}


# ── Payload Builders ──────────────────────────────────────────────────────────

def _build_flex_message(
    title: str,
    body: str,
    emoji: str,
    category: str = "system",
    priority: str = "medium",
) -> dict:
    """
    สร้าง LINE Flex Message แบบ Bubble สวยงาม
    รูปแบบ: แถบสีด้านบน + emoji + title + body
    """
    accent = _CATEGORY_COLOR.get(category, _BRAND_GREEN)
    icon = _PRIORITY_ICON.get(priority, "💬")

    return {
        "type": "flex",
        "altText": f"[NutriSmart] {title}",   # ข้อความสำรองสำหรับ push notification banner
        "contents": {
            "type": "bubble",
            "size": "kilo",
            "header": {
                "type": "box",
                "layout": "horizontal",
                "backgroundColor": accent,
                "paddingAll": "12px",
                "contents": [
                    {
                        "type": "text",
                        "text": f"{emoji}  NutriSmart",
                        "color": "#FFFFFF",
                        "weight": "bold",
                        "size": "sm",
                        "flex": 1,
                    },
                    {
                        "type": "text",
                        "text": icon,
                        "color": "#FFFFFF",
                        "size": "sm",
                        "align": "end",
                    },
                ],
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "paddingAll": "14px",
                "contents": [
                    {
                        "type": "text",
                        "text": title,
                        "weight": "bold",
                        "size": "md",
                        "color": "#111827",
                        "wrap": True,
                    },
                    {
                        "type": "separator",
                        "margin": "sm",
                        "color": "#F3F4F6",
                    },
                    {
                        "type": "text",
                        "text": body,
                        "size": "sm",
                        "color": "#6B7280",
                        "wrap": True,
                        "margin": "sm",
                    },
                ],
            },
            "footer": {
                "type": "box",
                "layout": "horizontal",
                "paddingAll": "10px",
                "backgroundColor": "#F9FAFB",
                "contents": [
                    {
                        "type": "text",
                        "text": "เปิด NutriSmart เพื่อดูรายละเอียด →",
                        "size": "xs",
                        "color": accent,
                        "weight": "bold",
                        "align": "center",
                    }
                ],
            },
            "styles": {
                "header": {"separator": False},
                "footer": {"separator": True, "separatorColor": "#E5E7EB"},
            },
        },
    }


def _build_text_message(title: str, body: str, emoji: str) -> dict:
    """Fallback: ข้อความ plain text (กรณี Flex ไม่ work)"""
    text = f"{emoji} {title}\n\n{body}\n\n— NutriSmart AI"
    return {"type": "text", "text": text}


# ── Main Public Function ──────────────────────────────────────────────────────

async def send_line_notification(
    line_user_id: str,
    title: str,
    body: str,
    emoji: str = "🔔",
    category: str = "system",
    priority: str = "medium",
    use_flex: bool = True,
) -> bool:
    """
    ส่ง Push Message ไปยังแอป LINE ของผู้ใช้

    Args:
        line_user_id: LINE User ID (เริ่มด้วย 'U' ตามด้วย 32 ตัวอักษร)
        title:        หัวข้อการแจ้งเตือน
        body:         เนื้อหาการแจ้งเตือน
        emoji:        Emoji ประกอบ (default 🔔)
        category:     ประเภท: daily | goal | ai | system
        priority:     ระดับ: low | medium | high
        use_flex:     ใช้ Flex Message (True) หรือ Plain Text (False)

    Returns:
        True ถ้าส่งสำเร็จ, False ถ้าล้มเหลว (ไม่ raise exception)
    """
    token = settings.line_channel_access_token
    if not token:
        logger.warning("[LINE] LINE_CHANNEL_ACCESS_TOKEN not configured — skipping push")
        return False

    if not line_user_id or not line_user_id.startswith("U"):
        logger.warning("[LINE] Invalid line_user_id format: %s — skipping", line_user_id)
        return False

    # สร้าง message payload
    if use_flex:
        message = _build_flex_message(title, body, emoji, category, priority)
    else:
        message = _build_text_message(title, body, emoji)

    payload = {
        "to": line_user_id,
        "messages": [message],
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=LINE_TIMEOUT_SEC) as client:
            resp = await client.post(LINE_PUSH_URL, headers=headers, json=payload)

        if resp.status_code == 200:
            logger.info("[LINE] Push sent to %s…%s ✓", line_user_id[:4], line_user_id[-4:])
            return True

        # Handle known LINE API errors gracefully
        error_body = resp.json() if resp.content else {}
        error_msg = error_body.get("message", resp.text[:200])

        if resp.status_code == 400:
            logger.warning("[LINE] Bad request (400): %s", error_msg)
        elif resp.status_code == 401:
            logger.error("[LINE] Unauthorized (401) — check LINE_CHANNEL_ACCESS_TOKEN")
        elif resp.status_code == 429:
            logger.warning("[LINE] Rate limited (429) — too many messages")
        else:
            logger.error("[LINE] Unexpected status %s: %s", resp.status_code, error_msg)

        return False

    except httpx.TimeoutException:
        logger.warning("[LINE] Request timed out after %ss", LINE_TIMEOUT_SEC)
        return False
    except httpx.RequestError as exc:
        logger.error("[LINE] Connection error: %s", exc)
        return False
    except Exception as exc:
        # กันระบบพังจาก edge case ที่ไม่คาดคิด
        logger.error("[LINE] Unexpected error: %s", exc, exc_info=True)
        return False


# ── Convenience Helper ────────────────────────────────────────────────────────

async def send_line_if_available(
    user_id: str,
    title: str,
    body: str,
    emoji: str = "🔔",
    category: str = "system",
    priority: str = "medium",
) -> None:
    """
    ดึง line_user_id จากตาราง profiles แล้วส่ง LINE notification ถ้ามี
    ใช้แทนการเขียน query + if-check ซ้ำๆ ในทุกจุดที่ต้องแจ้งเตือน

    ไม่ raise exception ไม่ว่ากรณีใดทั้งสิ้น — safe to fire-and-forget
    """
    try:
        from database import SessionLocal
        import models

        with SessionLocal() as db:
            profile = (
                db.query(models.Profile)
                .filter(models.Profile.id == user_id)
                .first()
            )
            line_user_id: Optional[str] = getattr(profile, "line_user_id", None)

        if not line_user_id:
            return  # ผู้ใช้ยังไม่ผูก LINE — ไม่ทำอะไร

        await send_line_notification(
            line_user_id=line_user_id,
            title=title,
            body=body,
            emoji=emoji,
            category=category,
            priority=priority,
        )
    except Exception as exc:
        logger.warning("[LINE] send_line_if_available failed (non-fatal): %s", exc)
