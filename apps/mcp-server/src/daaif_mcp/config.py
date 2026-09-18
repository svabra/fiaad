from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DAAIF_MCP_", extra="ignore")

    api_url: str = "http://127.0.0.1:8000/api/v1"
    tenant_id: str = "estv"
    user_id: str = "mcp.catalog@local"
    bearer_token: SecretStr = SecretStr("")
    timeout_seconds: float = 20.0
    host: str = "0.0.0.0"
    port: int = 8002
    allowed_hosts: list[str] = ["localhost:*", "127.0.0.1:*", "[::1]:*", "mcp-server:*"]
    allowed_origins: list[str] = ["http://localhost:*", "http://127.0.0.1:*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
