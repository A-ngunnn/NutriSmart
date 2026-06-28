"""
Router: /api/reviews – รีวิวแอปจากผู้ใช้จริง ใช้แสดงบน landing page (ไม่ใช่รีวิวปลอม/mockup)
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from services.storage_service import upsert_review, get_public_reviews, get_my_review
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


class ReviewRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=500)
    avatarUrl: Optional[str] = None  # ส่งมาเฉพาะถ้าผู้ใช้กดยินยอม "แสดงรูปโปรไฟล์ด้วย" ตอนรีวิว


class ReviewResponse(BaseModel):
    id: str
    name: str
    rating: int
    comment: str
    avatar_url: Optional[str] = None
    created_at: str


@router.get("/public", response_model=List[ReviewResponse])
def list_public_reviews():
    """รีวิว 4-5 ดาวล่าสุด — endpoint นี้ไม่ต้อง login เพราะ landing page เรียกก่อนผู้ใช้ sign in"""
    rows = get_public_reviews()
    return [ReviewResponse(**row) for row in rows]


@router.get("/me", response_model=Optional[ReviewResponse])
def get_own_review(user_id: str = Depends(get_current_user)):
    row = get_my_review(user_id)
    return ReviewResponse(**row) if row else None


@router.post("", response_model=ReviewResponse)
def submit_review(body: ReviewRequest, user_id: str = Depends(get_current_user)):
    row = upsert_review(user_id, body.name.strip(), body.rating, body.comment.strip(), body.avatarUrl)
    return ReviewResponse(**row)
