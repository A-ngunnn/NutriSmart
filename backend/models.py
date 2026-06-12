from sqlalchemy import Column, String, Float
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
