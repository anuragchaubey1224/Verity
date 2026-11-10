import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.db.postgres import AsyncSessionLocal
from backend.retrieval.dense_retriever import DenseRetriever, RetrievedChunk
from backend.retrieval.sparse_retriever import SparseRetriever
from backend.retrieval.hyde import generate_hypothetical_document
from backend.retrieval.graph_expander import retrieve_by_entities

log = logging.getLogger("verity.retrieval.hybrid")

_thread_pool = ThreadPoolExecutor(max_workers=4)


async def _retrieve_sparse(
    retriever: SparseRetriever,
    query: str,
    top_k: int,
    domain: str | None,
    user_id: str | None,
    document_id: str | None,
) -> list[RetrievedChunk]:
    """Use a private session because dense and sparse retrieval run concurrently."""
    async with AsyncSessionLocal() as session:
        return await retriever.retrieve(
            query,
            db=session,
            top_k=top_k,
            domain=domain,
            user_id=user_id,
            document_id=document_id,
        )


def _reciprocal_rank_fusion(
    results_lists: list[list[RetrievedChunk]], k: int = 60
) -> list[RetrievedChunk]:
    scores: dict[str, float] = {}
    chunk_map: dict[str, RetrievedChunk] = {}

    for results in results_lists:
        for rank, chunk in enumerate(results):
            key = f"{chunk.document_id}_{chunk.chunk_index}"
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank + 1)
            chunk_map[key] = chunk

    sorted_keys = sorted(scores, key=lambda x: scores[x], reverse=True)
    fused = [chunk_map[key] for key in sorted_keys]

    for chunk, key in zip(fused, sorted_keys):
        chunk.score = round(scores[key], 4)

    return fused


class HybridRetriever:
    def __init__(self, use_hyde: bool = True, use_graph: bool = True, use_rerank: bool | None = None):
        self.dense = DenseRetriever()
        self.sparse = SparseRetriever()
        self.use_hyde = use_hyde
        self.use_graph = use_graph
        self.use_rerank = settings.enable_reranker if use_rerank is None else use_rerank

    async def retrieve(
        self,
        query: str,
        db: AsyncSession,
        top_k: int = 8,
        domain: str | None = None,
        user_id: str | None = None,
        document_id: str | None = None,
    ) -> tuple[list[RetrievedChunk], float]:
        """Returns (chunks, best_dense_score).

        best_dense_score is the raw Qdrant cosine similarity of the top result
        (range 0-1). Use this for web fallback decisions — RRF scores are
        rank-based (always ~0.013-0.033) and meaningless for relevance threshold.
        """
        log.info("[hybrid] starting retrieval | hyde=%s | graph=%s | domain=%s | user=%s",
                 self.use_hyde, self.use_graph, domain, user_id)

        loop = asyncio.get_running_loop()

        if self.use_hyde:
            # HyDE (blocking LLM + ONNX) and sparse (async DB) run concurrently.
            # Dense must wait for the hypothetical document it embeds.
            hyde_task = loop.run_in_executor(_thread_pool, generate_hypothetical_document, query)
            dense_query, sparse_results = await asyncio.gather(
                hyde_task,
                _retrieve_sparse(
                    self.sparse,
                    query,
                    20,
                    domain,
                    user_id,
                    document_id,
                ),
            )
            dense_results = await loop.run_in_executor(
                _thread_pool, self.dense.retrieve, dense_query, 20, domain, user_id, document_id
            )
        else:
            # Fast path (chat): dense and sparse are independent — run both at once.
            sparse_results, dense_results = await asyncio.gather(
                _retrieve_sparse(
                    self.sparse,
                    query,
                    20,
                    domain,
                    user_id,
                    document_id,
                ),
                loop.run_in_executor(
                    _thread_pool, self.dense.retrieve, query, 20, domain, user_id, document_id
                ),
            )

        # Capture best cosine similarity BEFORE RRF overwrites scores
        best_dense_score = max((c.score for c in dense_results), default=0.0)
        log.info("[hybrid] best_dense_score=%.3f", best_dense_score)

        results_to_fuse = [dense_results, sparse_results]

        if self.use_graph and not document_id:
            graph_results = await loop.run_in_executor(
                _thread_pool, retrieve_by_entities, query, 10, domain, user_id
            )
            if graph_results:
                results_to_fuse.append(graph_results)
                log.info("[hybrid] graph=%d chunks added", len(graph_results))

        fused = _reciprocal_rank_fusion(results_to_fuse)

        if self.use_rerank and fused:
            from backend.retrieval.reranker import rerank
            final = rerank(query, fused[:settings.rerank_candidates], top_k)
        else:
            final = fused[:top_k]

        log.info("[hybrid] final %d chunks ready | best_dense=%.3f | rerank=%s",
                 len(final), best_dense_score, self.use_rerank)
        return final, best_dense_score
