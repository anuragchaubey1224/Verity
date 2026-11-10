import logging
import threading

from fastembed import TextEmbedding

from backend.core.config import settings

log = logging.getLogger("verity.ingestion.embedding")


class EmbeddingService:
    """Process-wide embedding model wrapper.

    Constructing `TextEmbedding` opens an ONNX session and allocates the model
    weights. Do not instantiate this directly in request paths — use
    `get_embedding_service()` so the whole process shares one model.
    """

    def __init__(self):
        log.info("[embedding] loading model: %s", settings.embedding_model)
        self.model = TextEmbedding(model_name=settings.embedding_model)
        log.info("[embedding] model ready")

    def embed(self, texts: list[str]) -> list[list[float]]:
        log.info("[embedding] embedding %d texts...", len(texts))
        vectors = list(self.model.embed(texts))
        log.info("[embedding] done | count=%d", len(vectors))
        return [v.tolist() for v in vectors]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


_service: EmbeddingService | None = None
_service_lock = threading.Lock()


def get_embedding_service() -> EmbeddingService:
    """Return the single shared embedding service for this process.

    Double-checked locking: retrieval runs in worker threads, and `lru_cache`
    can execute the factory twice on a concurrent first miss — which would load
    two ONNX models. The explicit lock guarantees exactly one.
    """
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = EmbeddingService()
    return _service
