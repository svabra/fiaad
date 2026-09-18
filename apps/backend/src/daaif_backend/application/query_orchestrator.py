from __future__ import annotations

import asyncio
from uuid import uuid4

from daaif_backend.application.events import TenantEventBroker
from daaif_backend.application.ports import QueryEngine, SqlOptimizer
from daaif_backend.domain.models import (
    QueryExecutionRequest,
    QueryExecutionResult,
    QueryOptimizationRequest,
    QueryOptimizationResult,
    TenantContext,
)


class QueryOrchestrator:
    """Coordinates jobs without depending on DuckDB or transport details."""

    def __init__(
        self,
        engine: QueryEngine,
        optimizer: SqlOptimizer,
        events: TenantEventBroker,
        timeout_seconds: float,
    ) -> None:
        self._engine = engine
        self._optimizer = optimizer
        self._events = events
        self._timeout_seconds = timeout_seconds

    async def execute(
        self, context: TenantContext, request: QueryExecutionRequest
    ) -> QueryExecutionResult:
        query_id = str(uuid4())
        await self._events.publish(
            context.tenant_id,
            "query.started",
            {"query_id": query_id, "user_id": context.user_id},
        )
        try:
            result = await asyncio.wait_for(
                self._engine.execute(context, request, query_id),
                timeout=self._timeout_seconds,
            )
        except Exception as exc:
            await self._events.publish(
                context.tenant_id,
                "query.failed",
                {"query_id": query_id, "message": str(exc)},
            )
            raise
        await self._events.publish(
            context.tenant_id,
            "query.completed",
            {
                "query_id": query_id,
                "row_count": result.row_count,
                "duration_ms": result.duration_ms,
            },
        )
        return result

    async def optimize(
        self, context: TenantContext, request: QueryOptimizationRequest
    ) -> QueryOptimizationResult:
        result = await self._optimizer.optimize(context, request)
        await self._events.publish(
            context.tenant_id,
            "query.optimized",
            {"user_id": context.user_id, "optimizer": result.optimizer},
        )
        return result

