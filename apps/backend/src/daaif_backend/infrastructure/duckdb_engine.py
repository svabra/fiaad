from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from time import perf_counter
from typing import Any

import duckdb
import sqlglot
from sqlglot import exp

from daaif_backend.domain.models import (
    QueryExecutionRequest,
    QueryExecutionResult,
    TenantContext,
)


_FORBIDDEN_SQL = re.compile(
    r"\b(attach|copy|create|delete|detach|drop|export|import|insert|install|load|"
    r"pragma|replace|truncate|update|vacuum)\b|\b(read_(?:csv|json|parquet|text)[a-z0-9_]*|"
    r"glob|httpfs|postgres_scan|sqlite_scan|iceberg_scan|delta_scan)\s*\(|(?:s3|https?|file)://",
    re.IGNORECASE,
)


def validate_read_only_sql(sql: str) -> None:
    if _FORBIDDEN_SQL.search(sql):
        raise ValueError("Only read-only SQL over registered DAAIF relations is allowed.")
    try:
        statements = sqlglot.parse(sql, read="duckdb")
    except sqlglot.errors.ParseError as exc:
        raise ValueError(f"Invalid DuckDB SQL: {exc}") from exc
    if len(statements) != 1:
        raise ValueError("Exactly one SQL statement is allowed.")
    statement = statements[0]
    if not isinstance(statement, (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        raise ValueError("The statement must be a SELECT query.")
    allowed_relations = {"sales"}
    cte_relations = {
        cte.alias_or_name.lower()
        for cte in statement.find_all(exp.CTE)
        if cte.alias_or_name
    }
    referenced = {table.name.lower() for table in statement.find_all(exp.Table)}
    unknown = sorted(referenced - allowed_relations - cte_relations)
    if unknown:
        raise ValueError(f"Unknown or unauthorized relation(s): {', '.join(unknown)}")


def _json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.hex()
    return value


class DuckDbQueryEngine:
    def __init__(self, data_root: Path, max_result_rows: int) -> None:
        self._data_root = data_root
        self._max_result_rows = max_result_rows
        self._locks: dict[str, asyncio.Lock] = {}

    def _tenant_path(self, tenant_id: str) -> Path:
        digest = hashlib.sha256(tenant_id.encode("utf-8")).hexdigest()[:20]
        directory = self._data_root / "tenants" / digest
        directory.mkdir(parents=True, exist_ok=True)
        return directory / "warehouse.duckdb"

    def _initialize(self, connection: duckdb.DuckDBPyConnection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sales (
                order_id INTEGER,
                order_date DATE,
                region VARCHAR,
                category VARCHAR,
                amount DECIMAL(12, 2)
            )
            """
        )
        count = connection.execute("SELECT count(*) FROM sales").fetchone()[0]
        if count == 0:
            connection.execute(
                """
                INSERT INTO sales VALUES
                  (1001, DATE '2026-01-12', 'Bern', 'Services', 128400.00),
                  (1002, DATE '2026-02-03', 'Zürich', 'Software', 98200.00),
                  (1003, DATE '2026-02-21', 'Romandie', 'Services', 76100.00),
                  (1004, DATE '2026-03-08', 'Bern', 'Software', 143900.00),
                  (1005, DATE '2026-04-17', 'Ticino', 'Services', 52750.00),
                  (1006, DATE '2025-12-12', 'Zürich', 'Hardware', 88900.00),
                  (1007, DATE '2026-05-01', 'Romandie', 'Hardware', 113500.00),
                  (1008, DATE '2026-06-19', 'Bern', 'Services', 67200.00)
                """
            )

    def _execute_sync(
        self,
        tenant_id: str,
        request: QueryExecutionRequest,
        query_id: str,
    ) -> QueryExecutionResult:
        validate_read_only_sql(request.sql)
        limit = min(request.max_rows, self._max_result_rows)
        started = perf_counter()
        with duckdb.connect(str(self._tenant_path(tenant_id))) as connection:
            self._initialize(connection)
            cursor = connection.execute(request.sql)
            columns = [description[0] for description in cursor.description or []]
            raw_rows = cursor.fetchmany(limit + 1)
        truncated = len(raw_rows) > limit
        rows = [[_json_value(value) for value in row] for row in raw_rows[:limit]]
        return QueryExecutionResult(
            query_id=query_id,
            columns=columns,
            rows=rows,
            row_count=len(rows),
            duration_ms=round((perf_counter() - started) * 1_000, 2),
            truncated=truncated,
        )

    async def execute(
        self,
        context: TenantContext,
        request: QueryExecutionRequest,
        query_id: str,
    ) -> QueryExecutionResult:
        lock = self._locks.setdefault(context.tenant_id, asyncio.Lock())
        async with lock:
            return await asyncio.to_thread(
                self._execute_sync, context.tenant_id, request, query_id
            )
