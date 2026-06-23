"""
LLM-as-judge evaluation — compares retrieval WITHOUT vs WITH the cross-encoder
reranker on a small golden question set.

Usage:
    python -m scripts.run_eval

Requires a populated knowledge base (ingest a few RAG papers first, e.g.
`python -m scripts.arxiv_ingest --query "retrieval augmented generation" --max 5 --domain ml`).
"""

import asyncio
import json
import os
from datetime import datetime, timezone

from backend.db.postgres import AsyncSessionLocal
from backend.evaluation.evaluator import RAGEvaluator
from backend.evaluation.schemas import EvalSample
from backend.retrieval.hybrid_retriever import HybridRetriever

METRICS = ["faithfulness", "answer_relevancy", "context_recall", "context_precision"]

# Golden dataset — manually written ground-truth answers.
EVAL_SAMPLES = [
    EvalSample(
        question="What is RAG and how does it work?",
        ground_truth=(
            "RAG (Retrieval-Augmented Generation) combines information retrieval with "
            "large language model generation. It embeds a query into a vector, searches "
            "a vector database for the most similar document chunks, and uses those chunks "
            "as context for the LLM to generate an accurate, grounded answer."
        ),
    ),
    EvalSample(
        question="What is dense retrieval?",
        ground_truth=(
            "Dense retrieval uses vector embeddings to find semantically similar documents. "
            "Each chunk is converted into a high-dimensional vector and approximate "
            "nearest-neighbour algorithms like HNSW are used to find the closest vectors at query time."
        ),
    ),
    EvalSample(
        question="What is hybrid retrieval and what is RRF?",
        ground_truth=(
            "Hybrid retrieval combines dense vector search with sparse keyword search such as "
            "BM25 or PostgreSQL full-text search. Results from both are fused using "
            "Reciprocal Rank Fusion (RRF), which balances exact keyword matches with semantic similarity."
        ),
    ),
    EvalSample(
        question="What are chunking strategies in RAG?",
        ground_truth=(
            "Chunking strategies determine how documents are split before embedding. "
            "Recursive character splitting is a good default for plain text and PDFs. "
            "Markdown-aware splitting respects heading boundaries. "
            "Semantic chunking uses embeddings to detect topic shifts and create more coherent chunks."
        ),
    ),
]


def _averages(results) -> dict:
    acc = {m: [] for m in METRICS}
    for r in results:
        summary = r.summary()
        for m in METRICS:
            if summary[m] is not None:
                acc[m].append(summary[m])
    return {m: (round(sum(v) / len(v), 4) if v else None) for m, v in acc.items()}


async def _run_config(name: str, retriever: HybridRetriever, db) -> dict:
    print(f"\n--- {name} ---")
    results = await RAGEvaluator(retriever).run(EVAL_SAMPLES, db=db)
    avg = _averages(results)
    for m in METRICS:
        print(f"  {m:<20} {avg[m]}")
    return avg


async def main() -> None:
    os.makedirs("reports", exist_ok=True)
    print(f"\nEvaluating {len(EVAL_SAMPLES)} samples — baseline vs reranker...")

    configs = [
        ("baseline", HybridRetriever(use_hyde=False, use_graph=False, use_rerank=False)),
        ("reranker", HybridRetriever(use_hyde=False, use_graph=False, use_rerank=True)),
    ]
    scores = {}
    async with AsyncSessionLocal() as db:
        for name, retriever in configs:
            scores[name] = await _run_config(name, retriever, db)

    # Comparison table
    print("\n" + "=" * 60)
    print(f"{'metric':<22}{'baseline':<12}{'reranker':<12}{'delta':<10}")
    print("-" * 60)
    base, rer = scores["baseline"], scores["reranker"]
    for m in METRICS:
        b, r = base[m], rer[m]
        delta = f"{r - b:+.4f}" if (b is not None and r is not None) else "—"
        print(f"{m:<22}{str(b):<12}{str(r):<12}{delta:<10}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "samples": len(EVAL_SAMPLES),
        "baseline": base,
        "reranker": rer,
    }
    with open("reports/eval_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved → reports/eval_report.json")


if __name__ == "__main__":
    asyncio.run(main())
