from __future__ import annotations

from daaif_backend.application.ports import MetadataRepository
from daaif_backend.domain.models import (
    CurationEvent,
    DataProduct,
    DataSource,
    DataSourceType,
    Overview,
    TenantContext,
)


class CatalogService:
    def __init__(self, repository: MetadataRepository) -> None:
        self._repository = repository

    async def overview(self, context: TenantContext) -> Overview:
        source_types = await self._repository.list_source_types(context.tenant_id)
        sources = await self._repository.list_sources(context.tenant_id)
        products = await self._repository.list_products(context.tenant_id)
        events = await self._repository.list_curation_events(context.tenant_id)
        return Overview(
            source_count=len(sources),
            source_type_count=len(source_types),
            product_count=len(products),
            published_product_count=sum(p.status == "published" for p in products),
            latest_curation_at=max((event.occurred_at for event in events), default=None),
        )

    async def source_types(self, context: TenantContext) -> list[DataSourceType]:
        return await self._repository.list_source_types(context.tenant_id)

    async def sources(self, context: TenantContext) -> list[DataSource]:
        return await self._repository.list_sources(context.tenant_id)

    async def products(self, context: TenantContext) -> list[DataProduct]:
        return await self._repository.list_products(context.tenant_id)

    async def curation_events(
        self, context: TenantContext, product_id: str | None = None
    ) -> list[CurationEvent]:
        return await self._repository.list_curation_events(context.tenant_id, product_id)

