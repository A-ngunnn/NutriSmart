from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings
import logging

logger = logging.getLogger("nutrismart.database")

settings = get_settings()

# ใช้ pool_pre_ping เพื่อตรวจสอบ connection ก่อนใช้งานทุกครั้ง
# ป้องกัน connection หลุดแล้ว crash
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
