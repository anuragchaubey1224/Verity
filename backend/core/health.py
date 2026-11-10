"""Dependency health probes.

Split liveness from readiness:

- liveness  — is the process up? (no external calls)
- readiness — can it actually serve? (Postgres, Qdrant, Redis)

Readiness intentionally uses short timeouts. A sleeping Neon compute or paused
Qdrant cluster must surface as "not ready" quickly instead of hanging the probe.
"""

import asyncio
import logging

from sqlalchemy import text

from backend.api.middleware.rate_limit import ping_redis
from backend.db.postgres import engine
from backend.db.qdrant_client import ping as qdrant_ping

log = logging.getLogger("verity.health")

PROBE_TIMEOUT_SECONDS = 2.0


async def _check_postgres() -> bool:
    async def _probe() -> bool:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True

    return await asyncio.wait_for(_probe(), timeout=PROBE_TIMEOUT_SECONDS)


async def _check_qdrant() -> bool:
    return await asyncio.wait_for(asyncio.to_thread(qdrant_ping), timeout=PROBE_TIMEOUT_SECONDS)


async def _check_redis() -> bool:
    return await asyncio.wait_for(ping_redis(), timeout=PROBE_TIMEOUT_SECONDS)


async def check_dependencies() -> dict[str, bool]:
    """Run all dependency probes concurrently. Never raises."""
    checks = {
        "postgres": _check_postgres(),
        "qdrant": _check_qdrant(),
        "redis": _check_redis(),
    }
    raw = await asyncio.gather(*checks.values(), return_exceptions=True)

    status: dict[str, bool] = {}
    for name, result in zip(checks, raw):
        if isinstance(result, BaseException):
            log.warning("[health] %s probe failed: %s", name, result)
            status[name] = False
        else:
            status[name] = bool(result)
    return status
