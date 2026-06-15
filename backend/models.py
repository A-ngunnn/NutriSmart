from sqlalchemy import Boolean, Column, String, Float, Integer
from database import Base

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    age = Column(String)
    gender = Column(String)
    weight = Column(String)
    height = Column(String)
    activity_level = Column(String)
    goal = Column(String)
    line_user_id = Column(String, nullable=True)   # LINE User ID (เริ่มด้วย 'U')
    created_at = Column(String, nullable=False)

class FoodLog(Base):
    __tablename__ = "food_logs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    meal_type = Column(String, nullable=False)
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    date = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)

class ScanHistory(Base):
    __tablename__ = "scan_history"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    product_name = Column(String, nullable=False)
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    total_fat = Column(Float, nullable=False)
    sugar = Column(Float, nullable=False)
    sodium = Column(Float, nullable=False)
    score = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    date = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)

class WaterLog(Base):
    __tablename__ = "water_logs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    category = Column(String, nullable=False)        # daily | goal | ai | system
    priority = Column(String, nullable=False)        # low | medium | high
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    emoji = Column(String, nullable=False, default="🔔")
    is_read = Column(Boolean, nullable=False, default=False)
    is_dismissed = Column(Boolean, nullable=False, default=False)
    read_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    endpoint = Column(String, nullable=False)
    date = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)


class GlobalFoodItem(Base):
    """
    ตารางอาหารส่วนกลาง — เก็บค่าเฉลี่ยที่ AI เคยวิเคราะห์ไว้แล้ว ใช้เป็นคลังหา Autocomplete แทน AI
    """
    __tablename__ = "global_food_items"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True, unique=True)
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    source = Column(String, nullable=False, default="scan")  # "scan" | "manual" | "seed"
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
