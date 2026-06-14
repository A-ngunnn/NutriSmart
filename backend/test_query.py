from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

url = 'postgresql://postgres.bkolvygakerlqueqzstb:Nutri.22122546@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
engine = create_engine(url)
SessionLocal = sessionmaker(bind=engine)

with SessionLocal() as db:
    try:
        user_id = 'cb9a0e77-6ff2-4865-8387-0b307f0d89c4'
        profile = db.query(models.Profile).filter(models.Profile.id == user_id).first()
        print('SUCCESS:', profile.id if profile else 'None')
    except Exception as e:
        print('ERROR:', str(e))
