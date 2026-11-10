import ssl
from urllib.parse import urlsplit, urlunsplit, urlencode, parse_qsl

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from backend.core.config import settings


def _normalize(raw_url: str) -> tuple[str, dict]:
    """Make any Postgres URL work with the asyncpg driver.

    Accepts a plain `postgresql://` string (e.g. Neon's connection string) or an
    explicit `postgresql+asyncpg://` URL. Strips libpq-only query params that
    asyncpg rejects (sslmode, channel_binding) and enables TLS for remote hosts.
    """
    url = raw_url
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    clean = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    connect_args: dict = {}
    host = parts.hostname or ""
    is_local = host in ("localhost", "127.0.0.1", "")
    # Managed Postgres (Neon, etc.) requires TLS; local docker does not.
    if not is_local or sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = ssl.create_default_context()
    connect_args["timeout"] = settings.postgres_connect_timeout_seconds

    return clean, connect_args


_db_url, _connect_args = _normalize(settings.postgres_url)

engine = create_async_engine(
    _db_url,
    echo=settings.app_env == "development",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # Neon scales to zero — drop stale connections gracefully
    pool_recycle=300,
    pool_timeout=settings.postgres_connect_timeout_seconds,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Celery runs each task in a fresh event loop via asyncio.run(). An asyncpg
# connection is bound to the loop it was opened on, so reusing a pooled connection
# from the shared `engine` on the next task's loop raises "got Future attached to a
# different loop". NullPool opens a fresh connection per task and closes it on
# checkin — nothing ever crosses event loops. Used only by the Celery workers;
# the FastAPI app keeps the pooled `engine` above.
worker_engine = create_async_engine(
    _db_url,
    echo=False,
    poolclass=NullPool,
    connect_args=_connect_args,
)

WorkerSessionLocal = async_sessionmaker(
    bind=worker_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency that provides a database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
