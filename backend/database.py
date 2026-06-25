from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings
import logging

logger = logging.getLogger("nutrismart.database")

settings = get_settings()

# Supabase Session-mode pooler caps at 15 concurrent connections.
# Keep pool small: pool_size=3 + max_overflow=2 = 5 max, well under the limit.
# pool_pre_ping validates connections before use (handles idle-disconnect).
# pool_recycle drops connections older than 5 min to avoid stale sockets.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=3,
    max_overflow=2,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
