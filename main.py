import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.middleware.rate_limit import ping_redis
from backend.api.routes.auth import router as auth_router
from backend.api.routes.research import router as research_router
from backend.core.config import settings
from backend.core.health import PROBE_TIMEOUT_SECONDS, check_dependencies
from backend.db.qdrant_client import init_collection, ping as qdrant_ping

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "loggers": {
        "verity": {"level": "INFO", "handlers": ["console"], "propagate": False},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
log = logging.getLogger("verity.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Verity starting up...")
    if settings.app_env == "production" and "localhost" in settings.cors_origins:
        log.warning(
            "CORS_ORIGINS still contains localhost in production — the deployed "
            "frontend will be blocked unless you set it to your real origin(s)."
        )
    try:
        await asyncio.to_thread(init_collection)
    except Exception:
        log.warning("Qdrant unreachable at startup — retrieval will be degraded until it recovers", exc_info=True)
    log.info("Ready.")
    yield
    log.info("Verity shutting down.")


app = FastAPI(title="Verity", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(research_router)


@app.get("/")
async def root():
    """Human/space-probe friendly root — HF Spaces and uptime monitors often hit `/`."""
    return {"service": "verity", "status": "ok", "docs": "/docs", "health": "/health"}


@app.get("/health/live")
async def health_live():
    """Liveness: process is up. No external calls — safe for container probes."""
    return {"status": "ok"}


@app.get("/health")
async def health():
    """Keep-alive probe: process + Qdrant.

    Deliberately does not touch Postgres: on Neon's free tier every wake-up
    consumes compute minutes, and this endpoint is pinged frequently to stop the
    HF Space from sleeping. Use `/health/ready` for a full dependency check.
    """
    try:
        qdrant_ok = await asyncio.wait_for(
            asyncio.to_thread(qdrant_ping), timeout=PROBE_TIMEOUT_SECONDS
        )
    except Exception:
        qdrant_ok = False
    return {"status": "ok", "qdrant": "ok" if qdrant_ok else "unreachable"}


@app.get("/health/warm")
async def health_warm():
    """Keep-alive probe for HF, Qdrant, and Redis without waking Postgres."""
    try:
        qdrant_ok, redis_ok = await asyncio.gather(
            asyncio.wait_for(asyncio.to_thread(qdrant_ping), timeout=PROBE_TIMEOUT_SECONDS),
            asyncio.wait_for(ping_redis(), timeout=PROBE_TIMEOUT_SECONDS),
        )
    except Exception:
        qdrant_ok = False
        redis_ok = False
    ready = qdrant_ok and redis_ok
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ok" if ready else "degraded",
            "qdrant": "ok" if qdrant_ok else "unreachable",
            "redis": "ok" if redis_ok else "unreachable",
        },
    )


@app.get("/health/ready")
async def health_ready():
    """Readiness: process + Postgres + Qdrant + Redis. 503 when any is down."""
    deps = await check_dependencies()
    ready = all(deps.values())
    body = {
        "status": "ready" if ready else "degraded",
        "checks": {k: "ok" if v else "unreachable" for k, v in deps.items()},
    }
    return JSONResponse(status_code=200 if ready else 503, content=body)
