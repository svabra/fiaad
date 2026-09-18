from __future__ import annotations

import difflib
import json
import re
from typing import Any

import httpx

from daaif_backend.domain.models import (
    DiffLine,
    QueryOptimizationRequest,
    QueryOptimizationResult,
    TenantContext,
)
from daaif_backend.infrastructure.duckdb_engine import validate_read_only_sql


def _diff(original: str, optimized: str) -> tuple[str, list[DiffLine]]:
    old = original.strip().splitlines()
    new = optimized.strip().splitlines()
    unified = "\n".join(
        difflib.unified_diff(old, new, fromfile="original.sql", tofile="optimized.sql", lineterm="")
    )
    lines: list[DiffLine] = []
    old_number = 0
    new_number = 0
    for line in difflib.ndiff(old, new):
        marker, text = line[:2], line[2:]
        if marker == "? ":
            continue
        if marker == "  ":
            old_number += 1
            new_number += 1
            lines.append(DiffLine(kind="equal", old_line=old_number, new_line=new_number, text=text))
        elif marker == "- ":
            old_number += 1
            lines.append(DiffLine(kind="remove", old_line=old_number, text=text))
        elif marker == "+ ":
            new_number += 1
            lines.append(DiffLine(kind="add", new_line=new_number, text=text))
    return unified, lines


def _likely_question(sql: str) -> str:
    lower = sql.lower()
    if "sum(" in lower and "region" in lower:
        return "Die Abfrage beantwortet wahrscheinlich, wie sich ein summierter Kennwert auf Regionen verteilt."
    if "count(" in lower:
        return "Die Abfrage beantwortet wahrscheinlich, wie viele Datensätze die gewählten Bedingungen erfüllen."
    return "Die Abfrage untersucht wahrscheinlich die ausgewählten Felder der gefilterten Datenbasis."


class HeuristicSqlOptimizer:
    async def optimize(
        self, context: TenantContext, request: QueryOptimizationRequest
    ) -> QueryOptimizationResult:
        del context
        original = request.sql.strip()
        validate_read_only_sql(original)
        optimized = original
        explanations: list[str] = []

        nested = re.compile(
            r"FROM\s*\(\s*SELECT\s+\*\s+FROM\s+([a-zA-Z_][\w]*)\s*\)\s+(?:AS\s+)?[a-zA-Z_][\w]*",
            re.IGNORECASE,
        )
        optimized, nested_count = nested.subn(r"FROM \1", optimized)
        if nested_count:
            explanations.append("Unnötige SELECT-*-Unterabfrage entfernt; der Optimizer sieht die Basistabelle direkt.")

        year_filter = re.compile(
            r"EXTRACT\s*\(\s*YEAR\s+FROM\s+([a-zA-Z_][\w.]*)\s*\)\s*=\s*(\d{4})",
            re.IGNORECASE,
        )

        def replace_year(match: re.Match[str]) -> str:
            column, year_text = match.group(1), match.group(2)
            year = int(year_text)
            return (
                f"{column} >= DATE '{year}-01-01' AND "
                f"{column} < DATE '{year + 1}-01-01'"
            )

        optimized, year_count = year_filter.subn(replace_year, optimized)
        if year_count:
            explanations.append("Funktionsfilter auf dem Datum in einen sargable Range-Filter umgeschrieben.")

        if not explanations:
            explanations.append("Die Abfrage ist bereits kompakt; es wurde keine riskante semantische Änderung vorgenommen.")
        optimized = optimized.strip()
        validate_read_only_sql(optimized)
        unified, lines = _diff(original, optimized)
        return QueryOptimizationResult(
            original_sql=original,
            optimized_sql=optimized,
            explanation=explanations,
            likely_question=_likely_question(original),
            unified_diff=unified,
            diff=lines,
            optimizer="rules",
            warnings=["AI Gateway ist nicht konfiguriert; deterministische Regeln wurden verwendet."],
        )


class AiGatewaySqlOptimizer:
    def __init__(self, base_url: str, api_key: str, model: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds

    async def optimize(
        self, context: TenantContext, request: QueryOptimizationRequest
    ) -> QueryOptimizationResult:
        del context
        validate_read_only_sql(request.sql)
        system_prompt = (
            "You optimize read-only DuckDB SQL. Preserve semantics. Never add external URLs, "
            "file reads, DDL, DML, INSTALL, LOAD, ATTACH, COPY or PRAGMA. Return one JSON object "
            "with optimized_sql, explanation (array of concise German strings), and likely_question "
            "(one German sentence). Do not include data rows."
        )
        user_prompt = json.dumps(
            {
                "dialect": "duckdb",
                "sql": request.sql,
                "schema_context": request.schema_context,
            },
            ensure_ascii=False,
        )
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/v1/chat/completions",
                headers=headers,
                json={
                    "model": self._model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
        content = payload["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        optimized = str(parsed["optimized_sql"]).strip()
        validate_read_only_sql(optimized)
        unified, lines = _diff(request.sql, optimized)
        return QueryOptimizationResult(
            original_sql=request.sql.strip(),
            optimized_sql=optimized,
            explanation=[str(item) for item in parsed.get("explanation", [])],
            likely_question=str(parsed.get("likely_question") or _likely_question(request.sql)),
            unified_diff=unified,
            diff=lines,
            optimizer="ai-gateway",
        )


class ResilientSqlOptimizer:
    def __init__(self, ai: AiGatewaySqlOptimizer | None, fallback: HeuristicSqlOptimizer) -> None:
        self._ai = ai
        self._fallback = fallback

    async def optimize(
        self, context: TenantContext, request: QueryOptimizationRequest
    ) -> QueryOptimizationResult:
        if self._ai is None:
            return await self._fallback.optimize(context, request)
        try:
            return await self._ai.optimize(context, request)
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            result = await self._fallback.optimize(context, request)
            result.warnings = [
                "AI Gateway war nicht verfügbar oder lieferte ungültiges SQL; sichere Regeln wurden verwendet.",
                f"Gateway-Fehlertyp: {type(exc).__name__}",
            ]
            return result
