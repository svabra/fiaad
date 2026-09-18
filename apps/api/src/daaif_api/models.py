from __future__ import annotations

from pydantic import BaseModel, Field


class RequestContext(BaseModel):
    tenant_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    user_id: str = Field(min_length=1, max_length=160)
    roles: tuple[str, ...] = ()
    correlation_id: str = Field(min_length=1, max_length=128)


class QueryExecutionRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=100_000)
    max_rows: int = Field(default=250, ge=1, le=5_000)


class QueryOptimizationRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=100_000)
    schema_context: str = Field(default="", max_length=20_000)

