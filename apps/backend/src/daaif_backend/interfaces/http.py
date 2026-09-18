from __future__ import annotations

import json

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from daaif_backend.domain.models import (
    CurationEvent,
    DataProduct,
    DataSource,
    DataSourceType,
    Overview,
    QueryExecutionRequest,
    QueryExecutionResult,
    QueryOptimizationRequest,
    QueryOptimizationResult,
    TenantContext,
)


router = APIRouter(prefix="/internal/v1")


def _services(request: Request):
    return request.app.state.services


async def tenant_context(
    request: Request,
    x_daaif_context: str = Header(alias="X-DAAIF-Context"),
) -> TenantContext:
    settings = request.app.state.settings
    try:
        payload = jwt.decode(
            x_daaif_context,
            settings.internal_context_secret.get_secret_value(),
            algorithms=["HS256"],
            audience="daaif-backend",
            issuer="daaif-api",
        )
        return TenantContext(
            tenant_id=payload["tid"],
            user_id=payload["sub"],
            roles=tuple(payload.get("roles", ())),
            correlation_id=payload["cid"],
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service context.",
        ) from exc


@router.get("/overview", response_model=Overview)
async def overview(request: Request, context: TenantContext = Depends(tenant_context)):
    return await _services(request).catalog.overview(context)


@router.get("/sources/types", response_model=list[DataSourceType])
async def source_types(request: Request, context: TenantContext = Depends(tenant_context)):
    return await _services(request).catalog.source_types(context)


@router.get("/sources", response_model=list[DataSource])
async def sources(request: Request, context: TenantContext = Depends(tenant_context)):
    return await _services(request).catalog.sources(context)


@router.get("/data-products", response_model=list[DataProduct])
async def data_products(request: Request, context: TenantContext = Depends(tenant_context)):
    return await _services(request).catalog.products(context)


@router.get("/curation-events", response_model=list[CurationEvent])
async def curation_events(
    request: Request,
    product_id: str | None = Query(default=None),
    context: TenantContext = Depends(tenant_context),
):
    return await _services(request).catalog.curation_events(context, product_id)


@router.post("/queries/execute", response_model=QueryExecutionResult)
async def execute_query(
    body: QueryExecutionRequest,
    request: Request,
    context: TenantContext = Depends(tenant_context),
):
    try:
        return await _services(request).queries.execute(context, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/queries/optimize", response_model=QueryOptimizationResult)
async def optimize_query(
    body: QueryOptimizationRequest,
    request: Request,
    context: TenantContext = Depends(tenant_context),
):
    try:
        return await _services(request).queries.optimize(context, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/events")
async def events(request: Request, context: TenantContext = Depends(tenant_context)):
    async def stream():
        yield "retry: 3000\n\n"
        async for event in _services(request).events.subscribe(context.tenant_id):
            if await request.is_disconnected():
                break
            if event is None:
                yield ": heartbeat\n\n"
                continue
            data = json.dumps(event.model_dump(mode="json"), separators=(",", ":"))
            yield f"id: {event.event_id}\nevent: message\ndata: {data}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

