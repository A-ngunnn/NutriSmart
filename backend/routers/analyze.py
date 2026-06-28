"""
Router: /api/analyze – Nutrition label analysis endpoints.
"""

import base64
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

from services.ai_service import analyze_label_image, analyze_manual_input
# แก้ไขจาก insert_meal_log เป็น insert_food_entry ให้ตรงกับของจริงในระบบ
from services.storage_service import insert_scan_record, check_and_log_api_usage, insert_food_entry
from middleware.auth import get_current_user
from config import get_settings
import uuid
from supabase import create_client

_logger = logging.getLogger("nutrismart.analyze")
settings = get_settings()

# Initialize Supabase client for storage
supabase = None
if settings.supabase_url and settings.supabase_anon_key:
    try:
        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
        try:
            supabase.storage.get_bucket("scans")
        except Exception:
            try:
                supabase.storage.create_bucket("scans", options={"public": True})
            except Exception as e:
                _logger.warning(f"Could not create scans bucket: {e}")
    except Exception as e:
        _logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

router = APIRouter(prefix="/api/analyze", tags=["Analyze"])


def _meal_type_from_time() -> str:
    h = datetime.now().hour
    if 5 <= h < 11:
        return "breakfast"
    if 11 <= h < 15:
        return "lunch"
    if 17 <= h < 21:
        return "dinner"
    return "snack"


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
    score = max(0.0, min(100.0, float(raw.get("score") or 0)))
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
        score=score,
        status=str(raw.get("status") or "danger"),
        warnings=list(raw.get("warnings") or []),
        advice=str(raw.get("advice") or ""),
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/image", response_model=AnalyzeResponse)
async def analyze_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """Analyze a nutrition label from an uploaded image and auto-save to diary."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="ไฟล์ที่อัปโหลดต้องเป็นรูปภาพ")

    # เช็ก Rate Limit 3 ครั้งต่อวัน (คุมต้นทุน AI vision model ช่วงที่ยังใช้ free tier อยู่)
    if not check_and_log_api_usage(user_id, "/api/analyze/image", max_limit=3):
        raise HTTPException(status_code=429, detail="คุณใช้งานโควตาสแกนอาหารครบ 3 ครั้งของวันนี้แล้วค่ะ")

    # Read and encode image
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        # ส่งให้ AI วิเคราะห์
        result = await analyze_label_image(image_base64, mime_type=file.content_type)
        safe_result = _safe_analyze_response(result)
        
        # อัปโหลดรูปภาพไป Supabase Storage
        image_url = None
        if supabase:
            try:
                ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
                filename = f"{user_id}/{uuid.uuid4()}.{ext}"
                supabase.storage.from_("scans").upload(
                    path=filename,
                    file=image_bytes,
                    file_options={"content-type": file.content_type}
                )
                image_url = supabase.storage.from_("scans").get_public_url(filename)
            except Exception as e:
                _logger.warning(f"Failed to upload image to Supabase: {e}")
        
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
            "image_url": image_url,
        })
        
        # 2. 🔥 One-Click Magic: เปลี่ยนมาเรียกใช้ insert_food_entry และ Map ฟิลด์ตามโครงสร้างโครงงานจริง
        insert_food_entry(user_id, {
            "name": safe_result.productName,
            "meal_type": _meal_type_from_time(),
            "calories": safe_result.calories,
            "protein": safe_result.protein,
            "carbs": safe_result.carbs,
            "fat": safe_result.totalFat
        }, bg_tasks=background_tasks)

        return safe_result
    except HTTPException:
        raise
    except Exception:
        _logger.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง")


@router.post("/manual", response_model=AnalyzeResponse)
async def analyze_manual(
    body: ManualAnalyzeRequest,
    background_tasks: BackgroundTasks,
    save: bool = True,
    user_id: str = Depends(get_current_user),
):
    """Analyze manually-entered nutrition data and auto-save to diary.

    save=false ใช้ตอนข้อมูลนี้มาจากการสแกนรูป (ผ่าน /api/analyze/image ที่ auto-save ไปแล้วรอบหนึ่ง
    พร้อม image_url) — ขั้นนี้แค่ขอคะแนนวิเคราะห์ ไม่ต้อง insert ซ้ำเป็นรายการที่สองของสแกนเดียวกัน
    """
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

        if save:
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
                "meal_type": _meal_type_from_time(),
                "calories": safe_result.calories,
                "protein": safe_result.protein,
                "carbs": safe_result.carbs,
                "fat": safe_result.totalFat
            }, bg_tasks=background_tasks)

        return safe_result
    except HTTPException:
        raise
    except Exception:
        _logger.exception("Manual analysis failed")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง")


class EstimateRequest(BaseModel):
    food_name: str

class EstimateResponse(BaseModel):
    foodName: str
    calories: float
    protein: float
    carbs: float
    fat: float

@router.post("/estimate", response_model=EstimateResponse)
async def estimate_food(
    body: EstimateRequest,
    background_tasks: BackgroundTasks,
    save: bool = True,
    user_id: str = Depends(get_current_user),
):
    """Estimate nutrition for a given food name. Pass save=false to skip auto-save."""
    try:
        from services.ai_service import estimate_food_nutrition
        result = await estimate_food_nutrition(body.food_name)

        product_name = result.get("foodName") or body.food_name
        calories     = float(result.get("calories") or 0)
        protein      = float(result.get("protein")  or 0)
        carbs        = float(result.get("carbs")    or 0)
        total_fat    = float(result.get("fat")      or 0)

        if save:
            insert_scan_record(user_id, {
                "product_name": product_name,
                "calories": calories, "protein": protein,
                "carbs": carbs, "total_fat": total_fat,
                "sugar": 0.0, "sodium": 0.0,
                "score": 50.0, "status": "moderate",
            })
            # insert_food_entry already upserts the GlobalFoodItem catalog itself
            insert_food_entry(user_id, {
                "name": product_name,
                "meal_type": _meal_type_from_time(),
                "calories": calories, "protein": protein,
                "carbs": carbs, "fat": total_fat,
            }, bg_tasks=background_tasks)
        else:
            # save=false (เช่นปุ่ม "ให้ AI ประมาณ" ที่แค่เติมฟอร์ม ยังไม่บันทึกไดอารี่) —
            # ยังควรเติมคลังกลางไว้ เพื่อให้คนต่อไปค้นชื่อนี้เจอเลยไม่ต้องเรียก AI ซ้ำ
            try:
                from routers.food_search import upsert_global_food
                upsert_global_food(
                    name=product_name, calories=calories, protein=protein,
                    carbs=carbs, fat=total_fat, source="ai",
                )
            except Exception:
                pass

        return EstimateResponse(**result)
    except HTTPException:
        raise
    except Exception:
        _logger.exception("Nutrition estimate failed")
        raise HTTPException(status_code=500, detail="เกิดข้อผิดพลาดในการประมาณค่า กรุณาลองใหม่อีกครั้ง")