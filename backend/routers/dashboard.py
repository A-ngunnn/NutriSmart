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
def dashboard_summary(user_id: str = Depends(get_current_user)):
    # `def` ธรรมดา (ไม่ใช่ async def) โดยตั้งใจ — get_dashboard_summary() เป็น sync/blocking
    # SQLAlchemy call ถ้าเป็น async def แล้วเรียก sync ตรงๆ จะบล็อก event loop ทั้งตัว
    return get_dashboard_summary(user_id)
