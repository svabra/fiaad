from __future__ import annotations

from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from daaif_api.backend_client import BackendClient
from daaif_api.config import Settings, get_settings
from daaif_api.models import QueryExecutionRequest, QueryOptimizationRequest, RequestContext
from daaif_api.security import request_context


def create_app(settings: Settings | None = None, backend: BackendClient | None = None) -> FastAPI:
    settings = settings or get_settings()
    backend = backend or BackendClient(
        settings.backend_url,
        settings.internal_context_secret.get_secret_value(),
        settings.backend_timeout_seconds,
    )
    app = FastAPI(
        title="DAAIF API",
        version="0.1.0",
        docs_url=None if settings.environment == "production" else "/docs",
    )
    app.state.settings = settings
    app.state.backend = backend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Tenant-ID", "X-User-ID", "X-Correlation-ID"],
    )

    @app.middleware("http")
    async def response_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "private, no-cache"
            response.headers["Vary"] = "Authorization, X-Tenant-ID"
        return response

    async def forward(
        method: str,
        path: str,
        context: RequestContext,
        *,
        params: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> Any:
        try:
            return await app.state.backend.request(
                method, path, context, params=params, json_body=body
            )
        except httpx.HTTPStatusError as exc:
            detail: Any = "Backend request failed."
            try:
                detail = exc.response.json().get("detail", detail)
            except (ValueError, AttributeError):
                pass
            raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Backend is unavailable.") from exc

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.service_name}

    @app.get("/ready")
    async def ready() -> dict[str, str]:
        if not await app.state.backend.healthy():
            raise HTTPException(status_code=503, detail="Backend is unavailable.")
        return {"status": "ready"}

    @app.get("/api/v1/overview")
    async def overview(context: RequestContext = Depends(request_context)):
        return await forward("GET", "/overview", context)

    @app.get("/api/v1/sources/types")
    async def source_types(context: RequestContext = Depends(request_context)):
        return await forward("GET", "/sources/types", context)

    @app.get("/api/v1/sources")
    async def sources(context: RequestContext = Depends(request_context)):
        return await forward("GET", "/sources", context)

    @app.get("/api/v1/data-products")
    async def products(context: RequestContext = Depends(request_context)):
        return await forward("GET", "/data-products", context)

    @app.get("/api/v1/curation-events")
    async def curation_events(
        product_id: str | None = Query(default=None),
        context: RequestContext = Depends(request_context),
    ):
        params = {"product_id": product_id} if product_id else None
        return await forward("GET", "/curation-events", context, params=params)

    @app.post("/api/v1/queries/execute")
    async def execute_query(
        body: QueryExecutionRequest,
        context: RequestContext = Depends(request_context),
    ):
        return await forward("POST", "/queries/execute", context, body=body.model_dump())

    @app.post("/api/v1/queries/optimize")
    async def optimize_query(
        body: QueryOptimizationRequest,
        context: RequestContext = Depends(request_context),
    ):
        return await forward("POST", "/queries/optimize", context, body=body.model_dump())

    @app.get("/api/v1/events")
    async def events(context: RequestContext = Depends(request_context)):
        return StreamingResponse(
            app.state.backend.stream_events(context),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()

