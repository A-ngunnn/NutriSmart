from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
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
        id=row["id"],
        user_id=row["user_id"],
        name=row["name"],
        mealType=row["meal_type"],
        calories=float(row["calories"]),
        protein=float(row["protein"]),
        carbs=float(row["carbs"]),
        fat=float(row["fat"]),
        date=row["date"],
        created_at=row["created_at"],
    )


def _scan_response(row: dict) -> ScanLogResponse:
    return ScanLogResponse(
        id=row["id"],
        user_id=row["user_id"],
        productName=row["product_name"],
        calories=float(row["calories"]),
        protein=float(row["protein"]),
        carbs=float(row["carbs"]),
        totalFat=float(row["total_fat"]),
        sugar=float(row["sugar"]),
        sodium=float(row["sodium"]),
        score=float(row["score"]),
        status=row["status"],
        date=row["date"],
        created_at=row["created_at"],
    )


def _water_response(row: dict) -> WaterLogResponse:
    return WaterLogResponse(
        id=row["id"],
        user_id=row["user_id"],
        amount=float(row["amount"]),
        date=row["date"],
        created_at=row["created_at"],
    )


@router.get("/food", response_model=List[FoodLogResponse])
async def list_food_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_food_entries(user_id)
    return [_food_response(row) for row in rows]


@router.post("/food", response_model=FoodLogResponse)
async def create_food_log(body: FoodLogRequest, user_id: Optional[str] = Query(None, alias="user_id")):
    row = insert_food_entry(user_id, {
        "name": body.name,
        "meal_type": body.mealType,
        "calories": body.calories,
        "protein": body.protein,
        "carbs": body.carbs,
        "fat": body.fat,
        "date": body.date,
    })
    return _food_response(row)


@router.delete("/food/{entry_id}")
async def remove_food_log(entry_id: str, user_id: Optional[str] = Query(None, alias="user_id")):
    ok = delete_food_entry(user_id, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Food entry not found")
    return {"success": True}


@router.get("/scan", response_model=List[ScanLogResponse])
async def list_scan_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_scan_history(user_id)
    return [_scan_response(row) for row in rows]


@router.post("/scan", response_model=ScanLogResponse)
async def create_scan_log(body: ScanLogRequest, user_id: Optional[str] = Query(None, alias="user_id")):
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
async def list_water_logs(user_id: Optional[str] = Query(None, alias="user_id")):
    rows = get_water_entries(user_id)
    return [_water_response(row) for row in rows]


@router.post("/water", response_model=WaterLogResponse)
async def create_water_log(body: WaterLogRequest, user_id: Optional[str] = Query(None, alias="user_id")):
    row = insert_water_entry(user_id, body.amount, body.date)
    return _water_response(row)


@router.delete("/water/{entry_id}")
async def remove_water_log(entry_id: str, user_id: Optional[str] = Query(None, alias="user_id")):
    ok = delete_water_entry(user_id, entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Water entry not found")
    return {"success": True}
