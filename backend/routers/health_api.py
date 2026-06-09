from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from services.storage_service import get_health_summary, get_service_status

router = APIRouter(prefix="/api/health", tags=["Health"])


class ServiceStatusResponse(BaseModel):
    status: str
    service: str
    version: str
    database: str
    model: str
    ai_api_key_set: bool
    database_error: Optional[str] = None


class HealthSummaryResponse(BaseModel):
    profile: dict
    tdee: int
    last_7_days: list
    avg_calories: int
    avg_scan_score: int
    scan_count: int
    macro_totals: dict
    scan_history: list


@router.get("/status", response_model=ServiceStatusResponse)
async def health_status():
    return get_service_status()


@router.get("/summary", response_model=HealthSummaryResponse)
async def health_summary(user_id: Optional[str] = Query(None, alias="user_id")):
    return get_health_summary(user_id)
