from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TenantContext(BaseModel):
    tenant_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    user_id: str = Field(min_length=1, max_length=160)
    roles: tuple[str, ...] = ()
    correlation_id: str = Field(min_length=1, max_length=128)


class SourceStatus(StrEnum):
    available = "available"
    degraded = "degraded"
    offline = "offline"


class DataSourceType(BaseModel):
    kind: str
    label: str
    count: int
    capabilities: list[str]


class DataSource(BaseModel):
    id: str
    name: str
    kind: str
    status: SourceStatus
    description: str
    location: str
    owner: str
    discovered_at: datetime
    capabilities: list[str] = Field(default_factory=list)


class DataProduct(BaseModel):
    id: str
    name: str
    description: str
    status: Literal["draft", "curated", "published"]
    source_ids: list[str]
    curated_by: str
    curated_at: datetime
    quality_score: float = Field(ge=0, le=1)
    tags: list[str] = Field(default_factory=list)


class CurationEvent(BaseModel):
    id: str
    product_id: str
    product_name: str
    action: Literal["created", "enriched", "validated", "published"]
    actor: str
    occurred_at: datetime
    summary: str


class Overview(BaseModel):
    source_count: int
    source_type_count: int
    product_count: int
    published_product_count: int
    latest_curation_at: datetime | None


class QueryExecutionRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=100_000)
    max_rows: int = Field(default=250, ge=1, le=5_000)

    @field_validator("sql")
    @classmethod
    def strip_sql(cls, value: str) -> str:
        return value.strip()


class QueryExecutionResult(BaseModel):
    query_id: str
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    duration_ms: float
    truncated: bool
    executed_at: datetime = Field(default_factory=utc_now)


class DiffLine(BaseModel):
    kind: Literal["equal", "add", "remove"]
    old_line: int | None = None
    new_line: int | None = None
    text: str


class QueryOptimizationRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=100_000)
    schema_context: str = Field(default="", max_length=20_000)


class QueryOptimizationResult(BaseModel):
    original_sql: str
    optimized_sql: str
    explanation: list[str]
    likely_question: str
    unified_diff: str
    diff: list[DiffLine]
    optimizer: Literal["ai-gateway", "rules"]
    warnings: list[str] = Field(default_factory=list)


class QueryEvent(BaseModel):
    event_id: str
    topic: str
    tenant_id: str
    occurred_at: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any]
