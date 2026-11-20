from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "dev"
    database_url: str = "sqlite:///./data/meetmatch.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    supabase_jwt_secret: str = ""
    bot_api_key: str = ""
    bot_username: str = ""
    dev_auth_bypass: bool = False
    profiles_path: str = "data/profiles.json"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
