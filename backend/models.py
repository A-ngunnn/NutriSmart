from sqlalchemy import Boolean, Column, String, Float, Integer
from database import Base

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, nullable=True)           # อีเมลผู้ใช้ (จาก Supabase auth)
    avatar_url = Column(String, nullable=True)      # URL รูปโปรไฟล์ (LINE pictureUrl / email gravatar / user upload)
    age = Column(String)
    gender = Column(String)
    weight = Column(String)
    height = Column(String)
    activity_level = Column(String)
    goal = Column(String)
    chronic_disease = Column(String, nullable=True)  # โรคประจำตัว เช่น เบาหวาน, ความดันโลหิตสูง, โรคไต — ใช้สำหรับ MedGemma วิเคราะห์เฉพาะบุคคล
    created_at = Column(String, nullable=False)


class DeviceToken(Base):
    """FCM registration token ของแต่ละอุปกรณ์/เบราว์เซอร์ — 1 user มีได้หลายเครื่อง (มือถือ+คอม)
    จึงแยกเป็นตารางของตัวเอง ไม่ใช่ column เดียวบน Profile เหมือน line_user_id เดิม"""
    __tablename__ = "device_tokens"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    fcm_token = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(String, nullable=False)


class DailyHealthSummary(Base):
    """แคชสรุปสารอาหารรายวัน — เติมข้อมูลแบบ write-through จาก get_health_summary() เพื่อลดการคำนวณซ้ำจาก food_logs/water_logs ดิบ"""
    __tablename__ = "daily_health_summaries"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    date = Column(String, index=True, nullable=False)
    total_calories = Column(Float, nullable=False, default=0)
    total_protein = Column(Float, nullable=False, default=0)
    total_carbs = Column(Float, nullable=False, default=0)
    total_fat = Column(Float, nullable=False, default=0)
    total_water = Column(Float, nullable=False, default=0)
    updated_at = Column(String, nullable=False)


class WeeklyMonthlySummary(Base):
    """แคชสรุปสารอาหารรายสัปดาห์/รายเดือน — เติมข้อมูลแบบ write-through จาก get_health_summary()"""
    __tablename__ = "weekly_monthly_summaries"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    period_type = Column(String, nullable=False)  # "weekly" | "monthly"
    start_date = Column(String, index=True, nullable=False)
    end_date = Column(String, nullable=False)
    avg_calories = Column(Float, nullable=False, default=0)
    total_calories = Column(Float, nullable=False, default=0)
    avg_water = Column(Float, nullable=False, default=0)
    updated_at = Column(String, nullable=False)

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
    image_url = Column(String, nullable=True)  # URL ของรูปภาพที่อัปโหลดไป Supabase Storage
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
    sample_count = Column(Integer, nullable=False, default=1)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
