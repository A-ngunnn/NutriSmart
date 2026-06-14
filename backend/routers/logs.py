from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

from services.storage_service import (
    delete_food_entry,
    delete_water_entry,
    get_food_entries,
    get_scan_history,
    get_water_entries,
    insert_food_entry,
    insert_scan_record,
    insert_water_entry,
)

router = APIRouter(prefix="/api/logs", tags=["Logs"])


class FoodLogRequest(BaseModel):
    name: str
    mealType: str
    calories: float
    protein: float
    carbs: float
    fat: float
    date: Optional[str] = None


class FoodLogResponse(FoodLogRequest):
    id: str
    user_id: str
    created_at: str
    date: str


class ScanLogRequest(BaseModel):
    productName: str
    calories: float
    protein: float
    carbs: float
    totalFat: float
    sugar: float
    sodium: float
    score: float
    status: str
    date: Optional[str] = None


class ScanLogResponse(ScanLogRequest):
    id: str
    user_id: str
    created_at: str
    date: str


class WaterLogRequest(BaseModel):
    amount: float
    date: Optional[str] = None


class WaterLogResponse(WaterLogRequest):
    id: str
    user_id: str
    created_at: str
    date: str


def _food_response(row: dict) -> FoodLogResponse:
    return FoodLogResponse(
        id=str(row.get("id") or ""),
        user_id=str(row.get("user_id") or ""),
        name=str(row.get("name") or ""),
        mealType=str(row.get("meal_type") or ""),
        calories=float(row.get("calories") or 0),
        protein=float(row.get("protein") or 0),
        carbs=float(row.get("carbs") or 0),
        fat=float(row.get("fat") or 0),
        date=str(row.get("date") or ""),
        created_at=str(row.get("created_at") or ""),
    )


def _scan_response(row: dict) -> ScanLogResponse:
    return ScanLogResponse(
        id=str(row.get("id") or ""),
        user_id=str(row.get("user_id") or ""),
        productName=str(row.get("product_name") or ""),
        calories=float(row.get("calories") or 0),
        protein=float(row.get("protein") or 0),
        carbs=float(row.get("carbs") or 0),
        totalFat=float(row.get("total_fat") or 0),
        sugar=float(row.get("sugar") or 0),
        sodium=float(row.get("sodium") or 0),
        score=float(row.get("score") or 0),
        status=str(row.get("status") or ""),
        date=str(row.get("date") or ""),
        created_at=str(row.get("created_at") or ""),
    )


def _water_response(row: dict) -> WaterLogResponse:
    return WaterLogResponse(
        id=str(row.get("id") or ""),
        user_id=str(row.get("user_id") or ""),
        amount=float(row.get("amount") or 0),
        date=str(row.get("date") or ""),
        created_at=str(row.get("created_at") or ""),
    )


@router.get("/food", response_model=List[FoodLogResponse])
def list_food_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_food_entries(user_id)
    return [_food_response(row) for row in rows]


@router.post("/food", response_model=FoodLogResponse)
def create_food_log(
    body: FoodLogRequest, 
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Query(None, alias="user_id")
):
    row = insert_food_entry(user_id, {
        "name": body.name,
        "meal_type": body.mealType,
        "calories": body.calories,
        "protein": body.protein,
        "carbs": body.carbs,
        "fat": body.fat,
        "date": body.date,
    }, bg_tasks=background_tasks)
    return _food_response(row)


@router.delete("/food/{entry_id}")
def remove_food_log(entry_id: str, user_id: Optional[str] = Query(None, alias="user_id")):
    ok = delete_food_entry(user_id, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Food entry not found")
    return {"success": True}


@router.get("/scan", response_model=List[ScanLogResponse])
def list_scan_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_scan_history(user_id)
    return [_scan_response(row) for row in rows]


@router.post("/scan", response_model=ScanLogResponse)
def create_scan_log(body: ScanLogRequest, user_id: Optional[str] = Query(None, alias="user_id")):
    row = insert_scan_record(user_id, {
        "product_name": body.productName,
        "calories": body.calories,
        "protein": body.protein,
        "carbs": body.carbs,
        "total_fat": body.totalFat,
        "sugar": body.sugar,
        "sodium": body.sodium,
        "score": body.score,
        "status": body.status,
        "date": body.date,
    })
    return _scan_response(row)


@router.get("/water", response_model=List[WaterLogResponse])
def list_water_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_water_entries(user_id)
    return [_water_response(row) for row in rows]


@router.post("/water", response_model=WaterLogResponse)
def create_water_log(
    body: WaterLogRequest, 
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Query(None, alias="user_id")
):
    row = insert_water_entry(user_id, body.amount, body.date, bg_tasks=background_tasks)
    return _water_response(row)


@router.delete("/water/{entry_id}")
def remove_water_log(entry_id: str, user_id: Optional[str] = Query(None, alias="user_id")):
    ok = delete_water_entry(user_id, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Water entry not found")
    return {"success": True}
