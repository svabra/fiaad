from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DAAIF_API_",
        env_file=".env",
        extra="ignore",
    )

    service_name: str = "daaif-api"
    environment: str = "development"
    backend_url: str = "http://127.0.0.1:8001/internal/v1"
    backend_timeout_seconds: float = 35.0
    internal_context_secret: SecretStr = SecretStr("local-context-secret-change-me")
    auth_mode: str = "dev"
    auth_jwt_secret: SecretStr = SecretStr("local-user-secret-change-me")
    auth_jwt_issuer: str = "daaif-orchestrator"
    auth_jwt_audience: str = "daaif-api"
    cors_origins: list[str] = ["http://localhost:4200"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

