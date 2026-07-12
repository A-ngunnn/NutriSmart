from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemini_api_key: str = ""
    # คีย์ Gemini สำรองจากโปรเจกต์/บัญชี Google อื่น (คั่นด้วย comma) — โควตาฟรีของ Gemini API
    # นับ "ต่อโปรเจกต์" ไม่ใช่ต่อคีย์ ดังนั้นต้องเป็นคีย์จากคนละโปรเจกต์ Google Cloud ถึงจะได้โควตาเพิ่ม
    # จริง (สร้างคีย์ซ้ำในโปรเจกต์เดิมแชร์โควตาเดียวกัน ไม่ช่วยอะไร)
    gemini_api_keys_extra: str = ""
    openrouter_api_key: str = ""
    # คีย์สำรองเพิ่มเติม (คั่นด้วย comma) — ใช้ตอนคีย์หลักโดน rate limit 429 จากโมเดลฟรี
    # (50 ครั้ง/วันรวมทั้งบัญชี) จะได้สลับไปคีย์ถัดไปแทนที่จะพังทั้งระบบ
    openrouter_api_keys_extra: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "nutri_knowledge"
    knowledge_dir: str = str(
        next(
            (p for p in [
                Path(__file__).resolve().parents[1] / "database" / "knowledge",  # project root / database / knowledge
                Path(__file__).resolve().parent / "database" / "knowledge",       # backend / database / knowledge
            ] if p.exists()),
            Path(__file__).resolve().parents[1] / "database" / "knowledge",      # default (log warning if missing)
        )
    )
    backend_port: int = 8080
    medgemma_model: str = "google/gemma-2-9b-it"
    medgemma_fallback_model: str = "gpt-4o-mini"
    storage_db: str = str(Path(__file__).resolve().parents[1] / "backend_data" / "nutrismart.db")
    database_url: str | None = None
    # Firebase Cloud Messaging (Web Push) — แทนที่ LINE Messaging API เดิม
    # ใส่อย่างใดอย่างหนึ่ง:
    #   FIREBASE_SERVICE_ACCOUNT_JSON = เนื้อ JSON ทั้งไฟล์แบบ string เดียว (สะดวกตอน deploy บน Render/Vercel)
    #   FIREBASE_SERVICE_ACCOUNT_PATH = path ไปยังไฟล์ serviceAccountKey.json (สะดวกตอน dev ในเครื่อง)
    firebase_service_account_json: str = ""
    firebase_service_account_path: str = ""
    cors_origins: str = "https://nutri-smart-gray.vercel.app,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def openrouter_api_keys_list(self) -> list[str]:
        """คีย์หลักก่อน ตามด้วยคีย์สำรอง (ถ้ามี) — เรียงตามลำดับที่จะลองใช้"""
        keys = [self.openrouter_api_key.strip()] if self.openrouter_api_key.strip() else []
        keys += [k.strip() for k in self.openrouter_api_keys_extra.split(",") if k.strip()]
        return keys

    @property
    def gemini_api_keys_list(self) -> list[str]:
        """คีย์หลักก่อน ตามด้วยคีย์จากโปรเจกต์ Google อื่นๆ (ถ้ามี) — เรียงตามลำดับที่จะลองใช้"""
        keys = [self.gemini_api_key.strip()] if self.gemini_api_key.strip() else []
        keys += [k.strip() for k in self.gemini_api_keys_extra.split(",") if k.strip()]
        return keys

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    if not settings.database_url:
        raise ValueError("CRITICAL ERROR: DATABASE_URL environment variable is not set. Please set it in .env file or environment variables.")
    return settings
