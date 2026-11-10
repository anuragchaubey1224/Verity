import logging

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PayloadSchemaType, VectorParams
from backend.core.config import settings

log = logging.getLogger("verity.qdrant")

client = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
    timeout=settings.qdrant_timeout_seconds,
)


def _validate_collection_schema() -> None:
    info = client.get_collection(collection_name=settings.qdrant_collection)
    vectors = info.config.params.vectors
    size = getattr(vectors, "size", None)
    distance = getattr(vectors, "distance", None)
    if size != settings.embedding_dimension or distance != Distance.COSINE:
        raise RuntimeError(
            "Qdrant collection schema mismatch: "
            f"expected size={settings.embedding_dimension}, distance={Distance.COSINE}; "
            f"found size={size}, distance={distance}"
        )


def init_collection():
    """Create the Qdrant collection on startup if it does not already exist."""
    existing = [c.name for c in client.get_collections().collections]

    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dimension,
                distance=Distance.COSINE,
            ),
        )
        log.info("Created Qdrant collection: %s", settings.qdrant_collection)
    else:
        _validate_collection_schema()
        log.info("Qdrant collection already exists: %s", settings.qdrant_collection)

    # Payload indexes for fast filtering on every retrieval (idempotent).
    for field in ("user_id", "domain"):
        try:
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception as exc:
            log.warning("Qdrant payload index already exists or could not be created: %s", exc)

    return True


def ping() -> bool:
    """Lightweight reachability check for /health — never raises."""
    try:
        client.get_collection(collection_name=settings.qdrant_collection)
        _validate_collection_schema()
        return True
    except Exception:
        return False
