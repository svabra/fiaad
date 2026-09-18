from __future__ import annotations

from typing import Protocol

from daaif_backend.domain.models import (
    CurationEvent,
    DataProduct,
    DataSource,
    DataSourceType,
    QueryExecutionRequest,
    QueryExecutionResult,
    QueryOptimizationRequest,
    QueryOptimizationResult,
    TenantContext,
)


class QueryEngine(Protocol):
    async def execute(
        self,
        context: TenantContext,
        request: QueryExecutionRequest,
        query_id: str,
    ) -> QueryExecutionResult: ...


class SqlOptimizer(Protocol):
    async def optimize(
        self,
        context: TenantContext,
        request: QueryOptimizationRequest,
    ) -> QueryOptimizationResult: ...


class MetadataRepository(Protocol):
    async def list_source_types(self, tenant_id: str) -> list[DataSourceType]: ...

    async def list_sources(self, tenant_id: str) -> list[DataSource]: ...

    async def list_products(self, tenant_id: str) -> list[DataProduct]: ...

    async def list_curation_events(
        self, tenant_id: str, product_id: str | None = None
    ) -> list[CurationEvent]: ...

