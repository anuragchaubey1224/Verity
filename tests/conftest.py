"""Test bootstrap.

Settings are required env vars (`BaseSettings` has no defaults for secrets and
datastores), and importing `main` builds the app. CI has no `.env`, so provide
syntactically valid dummy values. Nothing connects at import time: asyncpg and
redis lazy-connect, and Qdrant only opens a client object.
"""

import os

os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/verity")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-used-in-production")
