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
    database_url: str = "postgresql://user:password@localhost:5432/nutrismart"
    line_channel_access_token: str = ""  # LINE Messaging API — set LINE_CHANNEL_ACCESS_TOKEN in .env

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
