"""
Router: /api/analyze – Nutrition label analysis endpoints.
"""

import base64
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel

from services.ai_service import analyze_label_image, analyze_manual_input
# แก้ไขจาก insert_meal_log เป็น insert_food_entry ให้ตรงกับของจริงในระบบ
from services.storage_service import insert_scan_record, check_and_log_api_usage, insert_food_entry
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/analyze", tags=["Analyze"])


# ── Request/Response Models ──────────────────────────────────────────────────

class ManualAnalyzeRequest(BaseModel):
    productName: str
    calories: float
    protein: float
    carbs: float
    totalFat: float
    sugar: float
    sodium: float


class AnalyzeResponse(BaseModel):
    productName: str
    servingSize: Optional[str] = None
    calories: float
    protein: float
    carbs: float
    totalFat: float
    saturatedFat: Optional[float] = 0
    transFat: Optional[float] = 0
    sugar: float
    sodium: float
    fiber: Optional[float] = 0
    score: float
    status: str
    warnings: list[str] = []
    advice: str = ""

def _safe_analyze_response(raw: dict) -> AnalyzeResponse:
    return AnalyzeResponse(
        productName=str(raw.get("productName") or "ไม่ทราบชื่อ"),
        servingSize=str(raw.get("servingSize") or ""),
        calories=float(raw.get("calories") or 0),
        protein=float(raw.get("protein") or 0),
        carbs=float(raw.get("carbs") or 0),
        totalFat=float(raw.get("totalFat") or 0),
        saturatedFat=float(raw.get("saturatedFat") or 0),
        transFat=float(raw.get("transFat") or 0),
        sugar=float(raw.get("sugar") or 0),
        sodium=float(raw.get("sodium") or 0),
        fiber=float(raw.get("fiber") or 0),
        score=float(raw.get("score") or 0),
        status=str(raw.get("status") or "danger"),
        warnings=list(raw.get("warnings") or []),
        advice=str(raw.get("advice") or ""),
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/image", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """Analyze a nutrition label from an uploaded image and auto-save to diary."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="ไฟล์ที่อัปโหลดต้องเป็นรูปภาพ")

    # เช็ก Rate Limit 10 ครั้งต่อวัน
    if not check_and_log_api_usage(user_id, "/api/analyze/image", max_limit=10):
        raise HTTPException(status_code=429, detail="คุณใช้งานโควตาสแกนอาหารครบ 10 ครั้งของวันนี้แล้วค่ะ")

    # Read and encode image
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        # ส่งให้ AI วิเคราะห์
        result = await analyze_label_image(image_base64, mime_type=file.content_type)
        safe_result = _safe_analyze_response(result)
        
        # 1. บันทึกผลลงคลังสแกนส่วนตัว + อัปเดตคลังอาหารส่วนกลาง (Global Food Table)
        inserted = insert_scan_record(user_id, {
            "product_name": safe_result.productName,
            "calories": safe_result.calories,
            "protein": safe_result.protein,
            "carbs": safe_result.carbs,
            "total_fat": safe_result.totalFat,
            "sugar": safe_result.sugar,
            "sodium": safe_result.sodium,
            "score": safe_result.score,
            "status": safe_result.status,
        })
        
        # 2. 🔥 One-Click Magic: เปลี่ยนมาเรียกใช้ insert_food_entry และ Map ฟิลด์ตามโครงสร้างโครงงานจริง
        insert_food_entry(user_id, {
            "name": safe_result.productName,
            "meal_type": "Breakfast",  # ค่าเริ่มต้น ยูสเซอร์ไปปรับเปลี่ยนทีหลังได้
            "calories": safe_result.calories,
            "protein": safe_result.protein,
            "carbs": safe_result.carbs,
            "fat": safe_result.totalFat
        })
        
        return safe_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}")


@router.post("/manual", response_model=AnalyzeResponse)
async def analyze_manual(body: ManualAnalyzeRequest, user_id: str = Depends(get_current_user)):
    """Analyze manually-entered nutrition data and auto-save to diary."""
    try:
        result = await analyze_manual_input(
            product_name=body.productName,
            calories=body.calories,
            protein=body.protein,
            carbs=body.carbs,
            total_fat=body.totalFat,
            sugar=body.sugar,
            sodium=body.sodium,
        )
        safe_result = _safe_analyze_response(result)
        
        # 1. บันทึกผลลงคลังสแกนส่วนตัว
        insert_scan_record(user_id, {
            "product_name": safe_result.productName,
            "calories": safe_result.calories,
            "protein": safe_result.protein,
            "carbs": safe_result.carbs,
            "total_fat": safe_result.totalFat,
            "sugar": safe_result.sugar,
            "sodium": safe_result.sodium,
            "score": safe_result.score,
            "status": safe_result.status,
        })
        
        # 2. 🔥 เปลี่ยนมาเรียกใช้ insert_food_entry บันทึกลงไดอารี่อัตโนมัติ
        insert_food_entry(user_id, {
            "name": safe_result.productName,
            "meal_type": "Breakfast",
            "calories": safe_result.calories,
            "protein": safe_result.protein,
            "carbs": safe_result.carbs,
            "fat": safe_result.totalFat
        })
        
        return safe_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}")


class EstimateRequest(BaseModel):
    food_name: str

class EstimateResponse(BaseModel):
    foodName: str
    calories: float
    protein: float
    carbs: float
    fat: float

@router.post("/estimate", response_model=EstimateResponse)
async def estimate_food(body: EstimateRequest, user_id: str = Depends(get_current_user)):
    """Estimate nutrition for a given food name and auto-save to diary."""
    try:
        from services.ai_service import estimate_food_nutrition
        result = await estimate_food_nutrition(body.food_name)
        
        product_name = result.get("foodName") or body.food_name
        calories = float(result.get("calories") or 0)
        protein = float(result.get("protein") or 0)
        carbs = float(result.get("carbs") or 0)
        total_fat = float(result.get("fat") or 0)
        
        # 1. บันทึกผลลงคลังสแกนส่วนตัว
        insert_scan_record(user_id, {
            "product_name": product_name,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "total_fat": total_fat,
            "sugar": 0.0,
            "sodium": 0.0,
            "score": 50.0,
            "status": "moderate",
        })
        
        # 2. 🔥 เปลี่ยนมาเรียกใช้ insert_food_entry บันทึกลงไดอารี่อัตโนมัติ
        insert_food_entry(user_id, {
            "name": product_name,
            "meal_type": "Breakfast",
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fat": total_fat
        })
        
        return EstimateResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการประมาณค่า: {str(e)}")