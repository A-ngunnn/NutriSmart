"""
Router: /api/analyze – Nutrition label analysis endpoints.
"""

import base64
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from services.ai_service import analyze_label_image, analyze_manual_input

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


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/image", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
):
    """Analyze a nutrition label from an uploaded image."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="ไฟล์ที่อัปโหลดต้องเป็นรูปภาพ")

    # Read and encode image
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        result = await analyze_label_image(image_base64, mime_type=file.content_type)
        return AnalyzeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}")


@router.post("/manual", response_model=AnalyzeResponse)
async def analyze_manual(body: ManualAnalyzeRequest):
    """Analyze manually-entered nutrition data."""
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
        return AnalyzeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}")
