from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI

from daaif_backend.application.catalog_service import CatalogService
from daaif_backend.application.events import TenantEventBroker
from daaif_backend.application.query_orchestrator import QueryOrchestrator
from daaif_backend.config import Settings, get_settings
from daaif_backend.infrastructure.ai_gateway import (
    AiGatewaySqlOptimizer,
    HeuristicSqlOptimizer,
    ResilientSqlOptimizer,
)
from daaif_backend.infrastructure.duckdb_engine import DuckDbQueryEngine
from daaif_backend.infrastructure.metadata_repository import InMemoryMetadataRepository
from daaif_backend.interfaces.http import router


@dataclass
class Services:
    catalog: CatalogService
    queries: QueryOrchestrator
    events: TenantEventBroker


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    metadata = InMemoryMetadataRepository()
    events = TenantEventBroker()
    engine = DuckDbQueryEngine(settings.data_root, settings.max_result_rows)
    ai = None
    if settings.ai_gateway_base_url:
        ai = AiGatewaySqlOptimizer(
            settings.ai_gateway_base_url,
            settings.ai_gateway_api_key.get_secret_value(),
            settings.ai_gateway_model,
            settings.ai_gateway_timeout_seconds,
        )
    optimizer = ResilientSqlOptimizer(ai, HeuristicSqlOptimizer())
    services = Services(
        catalog=CatalogService(metadata),
        queries=QueryOrchestrator(engine, optimizer, events, settings.query_timeout_seconds),
        events=events,
    )
    app = FastAPI(
        title="DAAIF Backend",
        version="0.1.0",
        docs_url=None if settings.environment == "production" else "/docs",
    )
    app.state.settings = settings
    app.state.services = services
    app.include_router(router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.service_name}

    return app


app = create_app()

