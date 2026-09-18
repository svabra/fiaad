from __future__ import annotations

from datetime import datetime, timedelta, timezone

from daaif_backend.domain.models import (
    CurationEvent,
    DataProduct,
    DataSource,
    DataSourceType,
    SourceStatus,
)


class InMemoryMetadataRepository:
    """Tenant-filtered demo adapter; replace with a row-level-secured catalog DB."""

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    async def list_sources(self, tenant_id: str) -> list[DataSource]:
        now = self._now()
        prefix = tenant_id.upper()
        return [
            DataSource(
                id="s3-curated",
                name="Curated Object Storage",
                kind="s3",
                status=SourceStatus.available,
                description="Parquet-Zonen für kuratierte und publizierte Daten.",
                location=f"s3://{tenant_id}-curated/",
                owner=f"{prefix} Data Platform",
                discovered_at=now - timedelta(days=42),
                capabilities=["read", "write", "parquet", "partitioning"],
            ),
            DataSource(
                id="pg-finance",
                name="Finance PostgreSQL",
                kind="postgresql",
                status=SourceStatus.available,
                description="Transaktionale Finanzdaten, read-only erschlossen.",
                location="postgresql://finance.internal/analytics",
                owner=f"{prefix} Finance",
                discovered_at=now - timedelta(days=31),
                capabilities=["read", "schema-introspection", "predicate-pushdown"],
            ),
            DataSource(
                id="file-drop",
                name="Secure File Drop",
                kind="file",
                status=SourceStatus.degraded,
                description="Kontrollierte CSV-, JSON- und Parquet-Anlieferungen.",
                location=f"s3://{tenant_id}-landing/incoming/",
                owner=f"{prefix} Data Intake",
                discovered_at=now - timedelta(days=18),
                capabilities=["csv", "json", "parquet", "validation"],
            ),
        ]

    async def list_source_types(self, tenant_id: str) -> list[DataSourceType]:
        sources = await self.list_sources(tenant_id)
        definitions = {
            "s3": ("S3 / Object Storage", ["Parquet", "CSV", "Partition pruning"]),
            "postgresql": ("PostgreSQL", ["SQL", "Schema discovery", "Pushdown"]),
            "file": ("Datei-Anlieferung", ["CSV", "JSON", "Parquet"]),
        }
        return [
            DataSourceType(
                kind=kind,
                label=definitions[kind][0],
                count=sum(source.kind == kind for source in sources),
                capabilities=definitions[kind][1],
            )
            for kind in definitions
        ]

    async def list_products(self, tenant_id: str) -> list[DataProduct]:
        now = self._now()
        actor_domain = tenant_id.replace("-", ".")
        return [
            DataProduct(
                id="steuerertrag-cockpit",
                name="Steuerertrags-Cockpit",
                description="Regional aggregierte Steuererträge mit geprüfter Zeitdimension.",
                status="published",
                source_ids=["pg-finance", "s3-curated"],
                curated_by=f"noemie.rochat@{actor_domain}.example",
                curated_at=now - timedelta(days=2, hours=3),
                quality_score=0.97,
                tags=["Finanzen", "KPI", "monatlich"],
            ),
            DataProduct(
                id="mwst-analyse-2026",
                name="MWST Analyse 2026",
                description="Bereinigte Beleg- und Umsatzdaten für explorative Analysen.",
                status="curated",
                source_ids=["file-drop", "s3-curated"],
                curated_by=f"kassandra.valdata@{actor_domain}.example",
                curated_at=now - timedelta(hours=9),
                quality_score=0.91,
                tags=["MWST", "Qualität", "2026"],
            ),
        ]

    async def list_curation_events(
        self, tenant_id: str, product_id: str | None = None
    ) -> list[CurationEvent]:
        products = {product.id: product for product in await self.list_products(tenant_id)}
        now = self._now()
        events = [
            CurationEvent(
                id="evt-004",
                product_id="mwst-analyse-2026",
                product_name=products["mwst-analyse-2026"].name,
                action="validated",
                actor=products["mwst-analyse-2026"].curated_by,
                occurred_at=now - timedelta(hours=9),
                summary="Nullwerte geprüft und Qualitätsregeln erfolgreich ausgeführt.",
            ),
            CurationEvent(
                id="evt-003",
                product_id="steuerertrag-cockpit",
                product_name=products["steuerertrag-cockpit"].name,
                action="published",
                actor=products["steuerertrag-cockpit"].curated_by,
                occurred_at=now - timedelta(days=2, hours=3),
                summary="Version 1.4 für den internen Datenkatalog publiziert.",
            ),
            CurationEvent(
                id="evt-002",
                product_id="mwst-analyse-2026",
                product_name=products["mwst-analyse-2026"].name,
                action="enriched",
                actor=products["mwst-analyse-2026"].curated_by,
                occurred_at=now - timedelta(days=3),
                summary="Kantonsschlüssel und Geschäftsjahr ergänzt.",
            ),
            CurationEvent(
                id="evt-001",
                product_id="steuerertrag-cockpit",
                product_name=products["steuerertrag-cockpit"].name,
                action="created",
                actor=products["steuerertrag-cockpit"].curated_by,
                occurred_at=now - timedelta(days=24),
                summary="Datenprodukt aus der Finance-Quelle angelegt.",
            ),
        ]
        if product_id:
            events = [event for event in events if event.product_id == product_id]
        return events

