from urllib.parse import urlsplit
from types import SimpleNamespace

import pytest

from backend.core.config import settings
from backend.db.postgres import _normalize
from backend.db import qdrant_client


def test_postgres_normalization_adds_tls_and_timeout_for_remote_database():
    url, connect_args = _normalize(
        "postgresql://user:pass@db.example.com/app?sslmode=require&channel_binding=require"
    )

    parsed = urlsplit(url)
    assert parsed.scheme == "postgresql+asyncpg"
    assert "sslmode" not in parsed.query
    assert "channel_binding" not in parsed.query
    assert "ssl" in connect_args
    assert connect_args["timeout"] > 0


def test_postgres_normalization_keeps_local_database_without_tls():
    _, connect_args = _normalize("postgresql+asyncpg://postgres:password@localhost:5432/verity")

    assert "ssl" not in connect_args
    assert connect_args["timeout"] > 0


def test_invalid_timeout_configuration_is_rejected(monkeypatch):
    from backend.core.config import Settings

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("POSTGRES_URL", "postgresql+asyncpg://localhost/verity")
    monkeypatch.setenv("QDRANT_URL", "http://localhost:6333")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")
    monkeypatch.setenv("QDRANT_TIMEOUT_SECONDS", "0")

    with pytest.raises(ValueError):
        Settings(_env_file=None)


def test_qdrant_schema_validation_rejects_wrong_embedding_dimension(monkeypatch):
    collection_info = SimpleNamespace(
        config=SimpleNamespace(
            params=SimpleNamespace(
                vectors=SimpleNamespace(size=settings.embedding_dimension + 1, distance="Cosine")
            )
        )
    )
    monkeypatch.setattr(qdrant_client.client, "get_collection", lambda **_: collection_info)

    with pytest.raises(RuntimeError, match="schema mismatch"):
        qdrant_client._validate_collection_schema()
