import logging

import redis.asyncio as aioredis

from backend.core.config import settings

log = logging.getLogger("verity.rate_limit")

# Async client: this module is called from FastAPI request handlers. Using the
# sync Redis client there would block the event loop for every quota check
# (Upstash is a network round-trip, often 20-100 ms).
_client = aioredis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=settings.redis_connect_timeout_seconds,
    socket_timeout=settings.redis_socket_timeout_seconds,
    retry_on_timeout=True,
)

WINDOW_SECONDS = 20 * 60  # 20 minutes
MAX_REQUESTS = 20  # per authenticated user


async def check_rate_limit(subject: str) -> tuple[bool, int]:
    """Check whether `subject` is within the fixed-window request quota.

    Returns (is_allowed, retry_after_seconds).
    Fails open: if Redis is unreachable, the request is allowed rather than
    taking the whole product down.
    """
    key = f"rl:{subject}"
    try:
        pipe = _client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count, ttl = await pipe.execute()

        if ttl < 0:
            await _client.expire(key, WINDOW_SECONDS)
            ttl = WINDOW_SECONDS

        if count > MAX_REQUESTS:
            log.warning("[rate_limit] subject=%s blocked | count=%d | retry_after=%ds", subject, count, ttl)
            return False, max(ttl, 0)

        log.debug("[rate_limit] subject=%s | count=%d/%d", subject, count, MAX_REQUESTS)
        return True, 0

    except Exception as exc:
        log.warning("[rate_limit] Redis unavailable, skipping check: %s", exc)
        return True, 0


async def ping_redis() -> bool:
    """Readiness probe — never raises."""
    try:
        return bool(await _client.ping())
    except Exception:
        return False
