"""
Router: /api/food – ค้นหาอาหารจากคลัง GlobalFoodItem (ไม่ใช้ AI)
"""

import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from sqlalchemy import or_

import models
from database import SessionLocal
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/food", tags=["Food Search"])


# ── Response Model ────────────────────────────────────────────────────────────

class FoodItemResponse(BaseModel):
    id: str
    name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    source: str

    class Config:
        from_attributes = True


# ── Helper: upsert food to global catalog ─────────────────────────────────────

def upsert_global_food(name: str, calories: float, protein: float, carbs: float, fat: float, source: str = "scan") -> None:
    """
    เพิ่ม/อัปเดตเมนูอาหารเข้า global_food_items โดยอัตโนมัติ
    ถ้ามีชื่อซ้ำ → คำนวณค่าเฉลี่ยใหม่ ถ้าไม่มี → Insert ใหม่
    """
    now = datetime.utcnow().isoformat()
    try:
        with SessionLocal() as db:
            existing = db.query(models.GlobalFoodItem).filter(
                models.GlobalFoodItem.name == name
            ).first()

            if existing:
                # Running average over all samples seen so far, weighted by sample_count
                # (a plain (old + new) / 2 would over-weight the latest sample every time)
                n = existing.sample_count or 1
                existing.calories = round(existing.calories + (calories - existing.calories) / (n + 1), 1)
                existing.protein  = round(existing.protein  + (protein  - existing.protein)  / (n + 1), 1)
                existing.carbs    = round(existing.carbs    + (carbs    - existing.carbs)    / (n + 1), 1)
                existing.fat      = round(existing.fat      + (fat      - existing.fat)      / (n + 1), 1)
                existing.sample_count = n + 1
                existing.updated_at = now
            else:
                new_item = models.GlobalFoodItem(
                    id=str(uuid.uuid4()),
                    name=name,
                    calories=round(calories, 1),
                    protein=round(protein, 1),
                    carbs=round(carbs, 1),
                    fat=round(fat, 1),
                    source=source,
                    sample_count=1,
                    created_at=now,
                    updated_at=now,
                )
                db.add(new_item)

            db.commit()
    except Exception:
        pass  # non-fatal: ไม่ให้ catalog error ทำให้ feature หลักพัง


# ── Seed: เมนูอาหารไทยยอดนิยมสำหรับ Demo ────────────────────────────────────

SEED_FOODS = [
    ("ข้าวกะเพราไก่ไข่ดาว",  550, 25, 65, 18),
    ("ข้าวมันไก่",            480, 28, 55, 15),
    ("ข้าวผัด",               450, 15, 60, 14),
    ("ผัดไทย",                560, 18, 70, 20),
    ("ต้มยำกุ้ง",             180, 20, 10, 6),
    ("ส้มตำ",                 120,  3, 15,  5),
    ("แกงเขียวหวานไก่",       320, 22, 20, 18),
    ("ข้าวสวย 1 ทัพพี",       130,  3, 29,  0.5),
    ("โยเกิร์ตกรีก + กราโนล่า",250, 15, 30,  8),
    ("กล้วยน้ำว้า 1 ลูก",       90,  1, 21,  0.3),
    ("ขนมปังโฮลวีต 2 แผ่น",   160,  7, 28,  2),
    ("ไข่ดาว",                 80,  6,  0,  6),
    ("ไข่ต้ม",                 70,  6,  0,  5),
    ("นมวัวสด 1 แก้ว",        150,  8, 12,  8),
    ("นมถั่วเหลือง 1 แก้ว",   100,  7, 12,  4),
    ("สลัดผักรวม",             80,  3,  8,  4),
    ("ชาเขียวมัทฉะลาเต้",     160,  5, 25,  4),
    ("กาแฟดำ",                  5,  0,  1,  0),
    ("น้ำส้มคั้น 1 แก้ว",     110,  2, 26,  0),
    ("ข้าวโอ๊ตต้มกับนม",      250, 10, 40,  5),
    ("อกไก่ย่าง 100g",        165, 31,  0,  3.6),
    ("ปลาทูนึ่ง",             170, 26,  0,  7),
    ("บร็อกโคลีนึ่ง 100g",    55,  3, 10,  0.6),
    ("แอปเปิ้ล 1 ลูก",         95,  0, 25,  0.3),
    ("กล้วยหอม 1 ลูก",        105,  1, 27,  0.4),
    ("วุ้นเส้น",              130,  0, 32,  0),
    ("บะหมี่ต้ม",             220,  7, 42,  3),
    ("ข้าวเหนียว 100g",       180,  3, 40,  0.5),
    ("ชาไทยนมสด",             190,  3, 35,  5),
    ("โอเลี้ยง",               60,  1, 15,  0),
]

def seed_global_foods() -> int:
    """เพิ่มเมนูเริ่มต้นเข้า global_food_items (รันครั้งเดียวตอน startup)"""
    count = 0
    for name, cal, pro, carb, fat in SEED_FOODS:
        try:
            with SessionLocal() as db:
                if not db.query(models.GlobalFoodItem).filter(models.GlobalFoodItem.name == name).first():
                    upsert_global_food(name, cal, pro, carb, fat, source="seed")
                    count += 1
        except Exception:
            pass
    return count


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[FoodItemResponse])
def search_food(
    query: str = Query(..., min_length=1, description="คำค้นหาชื่ออาหาร"),
    limit: int = Query(default=8, le=20),
    _user_id: str = Depends(get_current_user),
):
    """
    ค้นหาอาหารในคลัง GlobalFoodItem แบบ Fuzzy (LIKE %query%)
    ไม่เรียก AI — ฟรี 100%
    """
    with SessionLocal() as db:
        results = (
            db.query(models.GlobalFoodItem)
            .filter(models.GlobalFoodItem.name.ilike(f"%{query}%"))
            .order_by(models.GlobalFoodItem.name)
            .limit(limit)
            .all()
        )
        return [
            FoodItemResponse(
                id=r.id,
                name=r.name,
                calories=r.calories,
                protein=r.protein,
                carbs=r.carbs,
                fat=r.fat,
                source=r.source,
            )
            for r in results
        ]


@router.get("/popular", response_model=List[FoodItemResponse])
def popular_foods(
    limit: int = Query(default=10, le=30),
    _user_id: str = Depends(get_current_user),
):
    """ดึงเมนูอาหารยอดนิยมจากคลัง (seed + scan) มาแสดงตอน input ว่าง"""
    with SessionLocal() as db:
        results = (
            db.query(models.GlobalFoodItem)
            .order_by(models.GlobalFoodItem.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [
            FoodItemResponse(
                id=r.id,
                name=r.name,
                calories=r.calories,
                protein=r.protein,
                carbs=r.carbs,
                fat=r.fat,
                source=r.source,
            )
            for r in results
        ]
