from typing import Optional

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel

from services.storage_service import get_dashboard_summary
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class DashboardSummaryResponse(BaseModel):
    profile: dict
    bmi: float
    tdee: int
    calories_today: int
    calories_remaining: int
    scan_count: int
    water_today: int
    water_target: int
    meal_totals: dict


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(user_id: str = Depends(get_current_user)):
    return get_dashboard_summary(user_id)
