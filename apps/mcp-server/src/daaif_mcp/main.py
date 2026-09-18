from __future__ import annotations

from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from daaif_mcp.api_client import DaaifApiClient
from daaif_mcp.config import get_settings


settings = get_settings()
api = DaaifApiClient(settings)
mcp = MCPServer(
    "DAAIF Data Catalog",
    instructions=(
        "Use these read-only tools to answer questions about data source types, "
        "curated data products and their curation history. Results are restricted "
        "to the authenticated tenant."
    ),
    version="0.1.0",
)


@mcp.tool()
async def list_source_types() -> list[dict[str, Any]]:
    """List the kinds of data sources DAAIF has connected for this tenant."""
    return await api.get("/sources/types")


@mcp.tool()
async def list_data_sources(kind: str | None = None) -> list[dict[str, Any]]:
    """List connected data sources, optionally filtered by source kind."""
    sources: list[dict[str, Any]] = await api.get("/sources")
    if kind:
        sources = [source for source in sources if source.get("kind", "").lower() == kind.lower()]
    return sources


@mcp.tool()
async def list_curated_data_products(status: str | None = None) -> list[dict[str, Any]]:
    """List curated or published data products and their responsible curators."""
    products: list[dict[str, Any]] = await api.get("/data-products")
    if status:
        products = [product for product in products if product.get("status") == status]
    return products


@mcp.tool()
async def get_curation_history(product_id: str | None = None) -> list[dict[str, Any]]:
    """Show who curated which data product, when, and what they changed."""
    params = {"product_id": product_id} if product_id else None
    return await api.get("/curation-events", params=params)


@mcp.tool()
async def answer_catalog_question(question: str) -> dict[str, Any]:
    """Answer a catalog question using current DAAIF API facts without executing SQL."""
    normalized = question.casefold()
    if any(word in normalized for word in ("quellentyp", "source type", "erschlossen")):
        return {"question": question, "answer_type": "source-types", "facts": await list_source_types()}
    if any(word in normalized for word in ("wer", "wann", "kuratiert", "histor")):
        return {"question": question, "answer_type": "curation-history", "facts": await get_curation_history()}
    return {"question": question, "answer_type": "data-products", "facts": await list_curated_data_products()}


@mcp.resource("daaif://catalog/source-types")
async def source_types_resource() -> list[dict[str, Any]]:
    """Tenant-scoped source type catalog."""
    return await list_source_types()


@mcp.resource("daaif://catalog/data-products")
async def products_resource() -> list[dict[str, Any]]:
    """Tenant-scoped curated data product catalog."""
    return await list_curated_data_products()


def run() -> None:
    mcp.run(
        transport="streamable-http",
        host=settings.host,
        port=settings.port,
        streamable_http_path="/mcp",
        stateless_http=True,
        json_response=True,
        max_request_body_size=1024 * 1024,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=settings.allowed_hosts,
            allowed_origins=settings.allowed_origins,
        ),
    )


if __name__ == "__main__":
    run()
