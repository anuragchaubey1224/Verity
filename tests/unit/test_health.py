import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_liveness_needs_no_dependencies():
    """Liveness must stay cheap: no Postgres/Qdrant/Redis calls."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_root_is_probe_friendly():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    assert response.json()["service"] == "verity"
    assert response.json()["health"] == "/health"
