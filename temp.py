from sqlalchemy import create_engine, text
url = 'postgresql://postgres.bkolvygakerlqueqzstb:Nutri.22122546@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
engine = create_engine(url)
with engine.connect() as conn:
    res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles'")).fetchall()
    print('COLUMNS:', res)
