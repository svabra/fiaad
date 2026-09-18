from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient
from pydantic import SecretStr

from daaif_backend.config import Settings
from daaif_backend.main import create_app


def token(secret: str, tenant: str = "estv") -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": "daaif-api",
            "aud": "daaif-backend",
            "sub": "analyst@test",
            "tid": tenant,
            "roles": ["analyst"],
            "cid": "test-correlation",
            "iat": now,
            "exp": now + timedelta(minutes=2),
        },
        secret,
        algorithm="HS256",
    )


def client(tmp_path) -> tuple[TestClient, dict[str, str]]:
    secret = "unit-test-context-secret"
    settings = Settings(
        data_root=tmp_path,
        internal_context_secret=SecretStr(secret),
        ai_gateway_base_url="",
    )
    return TestClient(create_app(settings)), {"X-DAAIF-Context": token(secret)}


def test_catalog_is_tenant_scoped(tmp_path):
    test_client, headers = client(tmp_path)
    estv = test_client.get("/internal/v1/sources", headers=headers)
    other_headers = {"X-DAAIF-Context": token("unit-test-context-secret", "bit-lab")}
    bit = test_client.get("/internal/v1/sources", headers=other_headers)
    assert estv.status_code == 200
    assert bit.status_code == 200
    assert estv.json()[0]["location"] != bit.json()[0]["location"]
    assert "estv" not in str(bit.json()).lower()


def test_executes_read_only_duckdb_query(tmp_path):
    test_client, headers = client(tmp_path)
    response = test_client.post(
        "/internal/v1/queries/execute",
        headers=headers,
        json={"sql": "SELECT region, SUM(amount) AS revenue FROM sales GROUP BY region ORDER BY revenue DESC"},
    )
    assert response.status_code == 200
    assert response.json()["columns"] == ["region", "revenue"]
    assert response.json()["row_count"] == 4


def test_rejects_unsafe_query(tmp_path):
    test_client, headers = client(tmp_path)
    response = test_client.post(
        "/internal/v1/queries/execute",
        headers=headers,
        json={"sql": "SELECT * FROM read_csv_auto('/etc/passwd')"},
    )
    assert response.status_code == 422
    assert "read-only" in response.json()["detail"]


def test_rule_optimizer_returns_explanation_and_diff(tmp_path):
    test_client, headers = client(tmp_path)
    response = test_client.post(
        "/internal/v1/queries/optimize",
        headers=headers,
        json={
            "sql": "SELECT region, SUM(amount) AS revenue\nFROM (SELECT * FROM sales) raw\nWHERE EXTRACT(YEAR FROM order_date) = 2026\nGROUP BY region"
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["optimizer"] == "rules"
    assert "DATE '2026-01-01'" in body["optimized_sql"]
    assert any(line["kind"] == "add" for line in body["diff"])

