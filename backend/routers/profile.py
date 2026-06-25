import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, field_validator

from services.storage_service import get_profile, upsert_profile, upsert_device_token, remove_device_token
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ProfileRequest(BaseModel):
    name: str = ""
    email: Optional[str] = None         # อีเมลผู้ใช้ (จาก Supabase auth / LINE)
    avatarUrl: Optional[str] = None     # URL รูปโปรไฟล์ (LINE pictureUrl / email avatar / ที่ผู้ใช้เลือก)
    age: str = ""
    gender: str = "male"
    weight: str = ""
    height: str = ""
    activityLevel: str = "sedentary"
    goal: str = "maintain"
    chronicDisease: str = ""  # โรคประจำตัว เช่น เบาหวาน, ความดันโลหิตสูง, โรคไต — ใช้สำหรับ MedGemma วิเคราะห์เฉพาะบุคคล

    @field_validator("age", "weight", "height", mode="before")
    @classmethod
    def must_be_non_negative(cls, v: object) -> str:
        if v is None or v == "":
            return ""
        try:
            num = float(str(v))
        except (ValueError, TypeError):
            raise ValueError(f"Must be a valid number, got: {v!r}")
        if math.isnan(num) or math.isinf(num) or num < 0:
            raise ValueError(f"Must be a non-negative number, got: {num}")
        return str(v)


class ProfileResponse(ProfileRequest):
    pass


class AvatarUpdateRequest(BaseModel):
    """เฉพาะ endpoint PATCH /api/profile/avatar — ไม่ต้องส่งข้อมูลทั้งหมด"""
    avatarUrl: str
    email: Optional[str] = None


class FcmTokenRequest(BaseModel):
    """token จาก Firebase Cloud Messaging ของอุปกรณ์/เบราว์เซอร์นี้ (ได้จาก getToken() ฝั่ง frontend)"""
    fcmToken: str


def _storage_profile(profile: ProfileRequest) -> dict:
    return {
        "name": profile.name,
        "email": profile.email or "",
        "avatar_url": profile.avatarUrl or "",
        "age": profile.age,
        "gender": profile.gender,
        "weight": profile.weight,
        "height": profile.height,
        "activity_level": profile.activityLevel,
        "goal": profile.goal,
        "chronic_disease": profile.chronicDisease,
    }


def _client_profile(raw: dict) -> ProfileResponse:
    return ProfileResponse(
        name=str(raw.get("name", "")),
        email=str(raw.get("email") or ""),
        avatarUrl=str(raw.get("avatar_url") or ""),
        age=str(raw.get("age") or ""),
        gender=str(raw.get("gender") or "male"),
        weight=str(raw.get("weight") or ""),
        height=str(raw.get("height") or ""),
        activityLevel=str(raw.get("activity_level") or "sedentary"),
        goal=str(raw.get("goal") or "maintain"),
        chronicDisease=str(raw.get("chronic_disease") or ""),
    )


@router.get("", response_model=ProfileResponse)
def fetch_profile(user_id: str = Depends(get_current_user)):
    # หมายเหตุ: เป็น `def` ธรรมดา (ไม่ใช่ async def) โดยตั้งใจ — get_profile() เป็น sync/blocking
    # SQLAlchemy call ถ้าประกาศเป็น async def แล้วเรียก sync code ตรงๆ จะบล็อก event loop ทั้งตัว
    # ทำให้ request อื่นที่เข้ามาพร้อมกัน (เช่น Promise.all จากฝั่ง frontend) ต้องรอเรียงคิวกันหมด
    # การใช้ def ธรรมดาให้ Starlette รัน handler นี้ใน thread pool แยกอัตโนมัติ ไม่บล็อก event loop
    profile = get_profile(user_id)
    return _client_profile(profile)


@router.put("", response_model=ProfileResponse)
def save_profile(body: ProfileRequest, user_id: str = Depends(get_current_user)):
    result = upsert_profile(user_id, _storage_profile(body))
    return _client_profile(result)


@router.patch("/avatar", response_model=ProfileResponse)
def update_avatar(body: AvatarUpdateRequest, user_id: str = Depends(get_current_user)):
    """อัปเดตเฉพาะรูปโปรไฟล์ (และอีเมล ถ้าส่งมา) โดยไม่ต้องส่งข้อมูลโปรไฟล์ทั้งหมด.

    Frontend เรียกนี้เมื่อ:
    1. ผู้ใช้กดเปลี่ยนรูปภาพบนหน้า Profile (ส่ง URL รูปใหม่มา)
    2. หลัง login ครั้งแรก (ดึง pictureUrl จาก LINE metadata มาเซฟ)
    """
    patch_data: dict = {"avatar_url": body.avatarUrl}
    if body.email:
        patch_data["email"] = body.email

    # ดึงข้อมูลเดิมก่อน แล้ว merge เข้ากับ patch (ไม่ลบ field อื่น)
    existing = get_profile(user_id)
    merged = {**existing, **patch_data}
    result = upsert_profile(user_id, merged)
    return _client_profile(result)


@router.patch("/fcm-token")
def register_fcm_token(body: FcmTokenRequest, user_id: str = Depends(get_current_user)):
    """ลงทะเบียน FCM token ของอุปกรณ์/เบราว์เซอร์นี้ — ใช้สำหรับรับ Web Push Notification
    เรียกหลังผู้ใช้กด "เปิดรับการแจ้งเตือน" และเบราว์เซอร์อนุญาตสิทธิ์ + ได้ token จาก Firebase แล้ว"""
    if not body.fcmToken.strip():
        raise HTTPException(status_code=400, detail="fcmToken ห้ามเป็นค่าว่าง")
    upsert_device_token(user_id, body.fcmToken.strip())
    return {"success": True}


@router.delete("/fcm-token")
def unregister_fcm_token(body: FcmTokenRequest, user_id: str = Depends(get_current_user)):
    """ยกเลิกรับการแจ้งเตือนบนอุปกรณ์นี้ (เช่น ผู้ใช้กดปิดสิทธิ์)"""
    remove_device_token(body.fcmToken.strip())
    return {"success": True}
