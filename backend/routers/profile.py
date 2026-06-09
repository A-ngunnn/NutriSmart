from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.storage_service import get_profile, upsert_profile

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
        name=raw.get("name", ""),
        age=raw.get("age", ""),
        gender=raw.get("gender", "male"),
        weight=raw.get("weight", ""),
        height=raw.get("height", ""),
        activityLevel=raw.get("activity_level", "sedentary"),
        goal=raw.get("goal", "maintain"),
    )


@router.get("", response_model=ProfileResponse)
async def fetch_profile(user_id: Optional[str] = Query(None, alias="user_id")):
    profile = get_profile(user_id)
    return _client_profile(profile)


@router.put("", response_model=ProfileResponse)
async def save_profile(body: ProfileRequest, user_id: Optional[str] = Query(None, alias="user_id")):
    result = upsert_profile(user_id, _storage_profile(body))
    return _client_profile(result)
