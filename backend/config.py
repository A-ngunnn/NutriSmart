from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemini_api_key: str
    supabase_url: str = ""
    supabase_anon_key: str = ""
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "nutri_knowledge"
    knowledge_dir: str = "../database/knowledge"
    backend_port: int = 8080

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
