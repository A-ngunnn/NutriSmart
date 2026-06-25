"""
Firebase Cloud Messaging (Web Push) Service – NutriSmart

แทนที่ LINE Messaging API เดิม (services/line_service.py — ไม่ถูกเรียกใช้แล้ว) เพราะค่าใช้จ่าย
ของ LINE OA หลังหมดโควตาฟรี เปลี่ยนมาใช้ FCM ส่ง Web Push เข้าเบราว์เซอร์ (มือถือ/คอม) แทน — ฟรี

การตั้งค่าที่ต้องมี (อย่างใดอย่างหนึ่งใน .env):
  FIREBASE_SERVICE_ACCOUNT_JSON = เนื้อไฟล์ serviceAccountKey.json แบบ string เดียว (เหมาะกับ deploy)
  FIREBASE_SERVICE_ACCOUNT_PATH = path ไปยังไฟล์ serviceAccountKey.json (เหมาะกับ dev ในเครื่อง)

วิธีได้ไฟล์ serviceAccountKey.json:
  Firebase Console > Project Settings > Service Accounts > Generate New Private Key
"""

import json
import logging
from typing import List, Optional

import firebase_admin
from firebase_admin import credentials, messaging

from config import get_settings

settings = get_settings()
logger = logging.getLogger("nutrismart.fcm_service")

_app: Optional[firebase_admin.App] = None
_init_attempted = False


def _get_app() -> Optional[firebase_admin.App]:
    """Lazy-init Firebase Admin SDK ครั้งเดียว — คืน None ถ้ายังไม่ตั้งค่า credential ไว้
    (ไม่ raise เพื่อไม่ให้ทั้ง backend พังถ้าผู้ดูแลยังไม่ได้ตั้งค่า Firebase)"""
    global _app, _init_attempted
    if _app is not None:
        return _app
    if _init_attempted:
        return None
    _init_attempted = True

    try:
        if settings.firebase_service_account_json:
            cred_data = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(cred_data)
        elif settings.firebase_service_account_path:
            cred = credentials.Certificate(settings.firebase_service_account_path)
        else:
            logger.warning(
                "[FCM] ไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH "
                "— ข้าม Push Notification ทั้งหมด (ใส่ค่าใน .env เพื่อเปิดใช้งาน)"
            )
            return None

        _app = firebase_admin.initialize_app(cred)
        logger.info("[FCM] Firebase Admin SDK initialized ✓")
        return _app
    except Exception as exc:
        logger.error("[FCM] Failed to initialize Firebase Admin SDK: %s", exc, exc_info=True)
        return None


# ── Single-token send ──────────────────────────────────────────────────────────

def send_push_notification(
    fcm_token: str,
    title: str,
    body: str,
    emoji: str = "🔔",
    category: str = "system",
    priority: str = "medium",
) -> bool:
    """ส่ง Web Push ไปยัง FCM token เดียว — คืน True ถ้าสำเร็จ, False ถ้าไม่สำเร็จ (ไม่ raise)"""
    app = _get_app()
    if app is None:
        return False

    try:
        message = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title=f"{emoji} {title}",
                body=body,
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=f"{emoji} {title}",
                    body=body,
                    icon="/icons/Logo.png",
                ),
                # ไม่ใส่ fcm_options.link เพราะ Firebase บังคับต้องเป็น absolute HTTPS URL เท่านั้น
                # (พังตอน dev บน http://localhost) — ปล่อยให้ service worker's notificationclick
                # listener จัดการเปิด/โฟกัสแท็บแอปเองแทน ไม่ต้องพึ่ง field นี้
            ),
            data={"category": category, "priority": priority},
        )
        message_id = messaging.send(message, app=app)
        logger.info("[FCM] Push sent ✓ (message_id=%s)", message_id)
        return True
    except messaging.UnregisteredError:
        # Token หมดอายุ/ถูก revoke (เช่น ผู้ใช้ล้าง cache เบราว์เซอร์) — ให้ผู้เรียกลบ token นี้ออกจาก DB
        logger.warning("[FCM] Token unregistered (stale) — caller should remove it: %s…", fcm_token[:12])
        raise
    except Exception as exc:
        logger.error("[FCM] Push failed: %s", exc, exc_info=True)
        return False


# ── Fan-out to all devices of a user ───────────────────────────────────────────

async def send_push_if_available(
    user_id: str,
    title: str,
    body: str,
    emoji: str = "🔔",
    category: str = "system",
    priority: str = "medium",
) -> None:
    """ดึง FCM token ทุกเครื่องของ user แล้วส่ง push ไปทุกเครื่อง (มือถือ+คอมอาจลงทะเบียนคนละ token)
    token ที่หมดอายุ/ถูก revoke จะถูกลบออกจาก DB ให้อัตโนมัติ

    ไม่ raise exception ไม่ว่ากรณีใด — safe to fire-and-forget เหมือน send_line_if_available เดิม"""
    try:
        from services.storage_service import get_device_tokens, remove_device_token

        tokens: List[str] = get_device_tokens(user_id)
        if not tokens:
            return  # ผู้ใช้ยังไม่เปิดรับ push บนอุปกรณ์ไหนเลย — ไม่ทำอะไร

        for token in tokens:
            try:
                send_push_notification(token, title, body, emoji, category, priority)
            except messaging.UnregisteredError:
                remove_device_token(token)
            except Exception as exc:
                logger.warning("[FCM] send to one device failed (non-fatal): %s", exc)
    except Exception as exc:
        logger.warning("[FCM] send_push_if_available failed (non-fatal): %s", exc)
