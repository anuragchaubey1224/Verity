from backend.retrieval.dense_retriever import RetrievedChunk
from backend.retrieval.hybrid_retriever import _reciprocal_rank_fusion


def _chunk(document_id: str, chunk_index: int) -> RetrievedChunk:
    return RetrievedChunk(
        text=f"{document_id}:{chunk_index}",
        document_id=document_id,
        chunk_index=chunk_index,
        page_number=None,
        score=0.0,
        domain=None,
    )


def test_rrf_rewards_chunks_that_appear_in_multiple_lists():
    dense_only = _chunk("doc-a", 0)
    in_both = _chunk("doc-b", 0)

    fused = _reciprocal_rank_fusion([
        [dense_only, in_both],   # rank 1, rank 2
        [in_both],               # rank 1
    ])

    # doc-b appears in both retrievers, so its summed reciprocal rank wins.
    assert fused[0].document_id == "doc-b"
    assert fused[0].score > fused[1].score


def test_rrf_keeps_unique_identity_by_document_and_chunk():
    same_position = _chunk("doc-a", 3)
    fused = _reciprocal_rank_fusion([[same_position], [same_position]])
    assert len(fused) == 1
