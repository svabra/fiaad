from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DAAIF_BACKEND_",
        env_file=".env",
        extra="ignore",
    )

    service_name: str = "daaif-backend"
    environment: str = "development"
    data_root: Path = Path(".data/backend")
    internal_context_secret: SecretStr = SecretStr("local-context-secret-change-me")
    max_result_rows: int = 1_000
    query_timeout_seconds: float = 30.0
    ai_gateway_base_url: str = ""
    ai_gateway_api_key: SecretStr = SecretStr("")
    ai_gateway_model: str = "sql-optimizer"
    ai_gateway_timeout_seconds: float = 25.0


@lru_cache
def get_settings() -> Settings:
    return Settings()

