from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "nutri_knowledge"
    knowledge_dir: str = str(Path(__file__).resolve().parents[1] / "database" / "knowledge")
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

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    if not settings.database_url:
        raise ValueError("CRITICAL ERROR: DATABASE_URL environment variable is not set. Please set it in .env file or environment variables.")
    return settings
