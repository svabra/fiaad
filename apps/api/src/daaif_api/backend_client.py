from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from daaif_api.models import RequestContext
from daaif_api.security import encode_internal_context


class BackendClient:
    def __init__(self, base_url: str, secret: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._secret = secret
        self._timeout = timeout_seconds

    def _headers(self, context: RequestContext) -> dict[str, str]:
        return {
            "X-DAAIF-Context": encode_internal_context(context, self._secret),
            "X-Correlation-ID": context.correlation_id,
        }

    async def request(
        self,
        method: str,
        path: str,
        context: RequestContext,
        *,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout, trust_env=False) as client:
            response = await client.request(
                method,
                f"{self._base_url}{path}",
                headers=self._headers(context),
                params=params,
                json=json_body,
            )
            response.raise_for_status()
            return response.json()

    async def healthy(self) -> bool:
        health_url = self._base_url.removesuffix("/internal/v1") + "/health"
        try:
            async with httpx.AsyncClient(timeout=2.0, trust_env=False) as client:
                response = await client.get(health_url)
                return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def stream_events(self, context: RequestContext) -> AsyncIterator[bytes]:
        timeout = httpx.Timeout(connect=5.0, read=None, write=5.0, pool=5.0)
        try:
            async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
                async with client.stream(
                    "GET",
                    f"{self._base_url}/events",
                    headers=self._headers(context),
                ) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_raw():
                        yield chunk
        except httpx.HTTPError as exc:
            payload = json.dumps(
                {"topic": "connection.error", "payload": {"message": type(exc).__name__}}
            )
            yield f"event: message\ndata: {payload}\n\n".encode()
