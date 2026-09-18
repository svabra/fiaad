from collections.abc import AsyncIterator
from typing import Any

from fastapi.testclient import TestClient

from daaif_api.config import Settings
from daaif_api.main import create_app


class StubBackend:
    def __init__(self) -> None:
        self.context = None

    async def healthy(self) -> bool:
        return True

    async def request(self, method: str, path: str, context, **kwargs) -> Any:
        self.context = context
        if path == "/overview":
            return {"source_count": 3, "source_type_count": 3, "product_count": 2, "published_product_count": 1, "latest_curation_at": None}
        return []

    async def stream_events(self, context) -> AsyncIterator[bytes]:
        self.context = context
        yield b": heartbeat\n\n"


def test_api_propagates_tenant_context():
    backend = StubBackend()
    app = create_app(Settings(auth_mode="dev"), backend=backend)
    response = TestClient(app).get(
        "/api/v1/overview",
        headers={"X-Tenant-ID": "bit-lab", "X-User-ID": "brayan@test"},
    )
    assert response.status_code == 200
    assert response.headers["vary"] == "Authorization, X-Tenant-ID"
    assert backend.context.tenant_id == "bit-lab"
    assert backend.context.user_id == "brayan@test"


def test_readiness_checks_backend():
    response = TestClient(create_app(Settings(auth_mode="dev"), backend=StubBackend())).get("/ready")
    assert response.status_code == 200

