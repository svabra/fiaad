from daaif_mcp.config import Settings


def test_mcp_targets_public_api_not_backend():
    settings = Settings(api_url="http://api:8000/api/v1")
    assert settings.api_url.endswith("/api/v1")
    assert "backend" not in settings.api_url

