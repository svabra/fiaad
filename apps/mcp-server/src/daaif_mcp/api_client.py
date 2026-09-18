from __future__ import annotations

from typing import Any

import httpx

from daaif_mcp.config import Settings


class DaaifApiClient:
    """Least-privilege MCP adapter: all data access goes through DAAIF API."""

    def __init__(self, settings: Settings) -> None:
        self._base_url = settings.api_url.rstrip("/")
        self._timeout = settings.timeout_seconds
        self._headers = {
            "X-Tenant-ID": settings.tenant_id,
            "X-User-ID": settings.user_id,
        }
        token = settings.bearer_token.get_secret_value()
        if token:
            self._headers = {"Authorization": f"Bearer {token}"}

    async def get(self, path: str, params: dict[str, str] | None = None) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout, trust_env=False) as client:
            response = await client.get(
                f"{self._base_url}{path}", headers=self._headers, params=params
            )
            response.raise_for_status()
            return response.json()
