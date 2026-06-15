from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from services.storage_service import get_profile, upsert_profile
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ProfileRequest(BaseModel):
    name: str = ""
    age: str = ""
    gender: str = "male"
    weight: str = ""
    height: str = ""
    activityLevel: str = "sedentary"
    goal: str = "maintain"


class ProfileResponse(ProfileRequest):
    pass


def _storage_profile(profile: ProfileRequest) -> dict:
    return {
        "name": profile.name,
        "age": profile.age,
        "gender": profile.gender,
        "weight": profile.weight,
        "height": profile.height,
        "activity_level": profile.activityLevel,
        "goal": profile.goal,
    }


def _client_profile(raw: dict) -> ProfileResponse:
    return ProfileResponse(
        name=str(raw.get("name", "")),
        age=str(raw.get("age") or ""),
        gender=str(raw.get("gender") or "male"),
        weight=str(raw.get("weight") or ""),
        height=str(raw.get("height") or ""),
        activityLevel=str(raw.get("activity_level") or "sedentary"),
        goal=str(raw.get("goal") or "maintain"),
    )


@router.get("", response_model=ProfileResponse)
async def fetch_profile(user_id: str = Depends(get_current_user)):
    profile = get_profile(user_id)
    return _client_profile(profile)


@router.put("", response_model=ProfileResponse)
async def save_profile(body: ProfileRequest, user_id: str = Depends(get_current_user)):
    result = upsert_profile(user_id, _storage_profile(body))
    return _client_profile(result)
