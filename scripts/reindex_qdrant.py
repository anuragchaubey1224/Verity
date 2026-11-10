"""Rebuild or audit the Qdrant index from PostgreSQL chunks.

Default mode is a read-only consistency report. Use --recreate to replace the
collection and re-embed every PostgreSQL chunk.
"""

import argparse
import asyncio
import logging
from dataclasses import dataclass

from qdrant_client.models import PointStruct
from sqlalchemy import select

from backend.core.config import settings
from backend.db.models.chunk import Chunk
from backend.db.models.document import Document
from backend.db.postgres import AsyncSessionLocal
from backend.db.qdrant_client import (
    client,
    deterministic_point_id,
    init_collection,
)
from backend.ingestion.embedding.embedding_service import get_embedding_service

log = logging.getLogger("verity.reindex")
BATCH_SIZE = 64


@dataclass(frozen=True)
class ExpectedPoint:
    chunk: Chunk
    document: Document
    point_id: str


async def load_chunks() -> list[ExpectedPoint]:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(Chunk, Document)
                .join(Document, Document.id == Chunk.document_id)
                .order_by(Chunk.document_id, Chunk.chunk_index)
            )
        ).all()
    return [
        ExpectedPoint(chunk=chunk, document=document, point_id=deterministic_point_id(chunk.id))
        for chunk, document in rows
    ]


def existing_point_ids() -> set[str]:
    if not client.collection_exists(settings.qdrant_collection):
        return set()
    point_ids: set[str] = set()
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=settings.qdrant_collection,
            offset=offset,
            limit=256,
            with_payload=False,
            with_vectors=False,
        )
        point_ids.update(str(record.id) for record in records)
        if offset is None:
            return point_ids


async def consistency_report(expected: list[ExpectedPoint]) -> dict[str, int]:
    expected_ids = {item.point_id for item in expected}
    actual_ids = existing_point_ids()
    return {
        "postgres_chunks": len(expected_ids),
        "qdrant_points": len(actual_ids),
        "missing_points": len(expected_ids - actual_ids),
        "orphan_points": len(actual_ids - expected_ids),
    }


async def rebuild(expected: list[ExpectedPoint]) -> None:
    if client.collection_exists(settings.qdrant_collection):
        client.delete_collection(settings.qdrant_collection)
    init_collection()

    embedder = get_embedding_service()
    async with AsyncSessionLocal() as db:
        for start in range(0, len(expected), BATCH_SIZE):
            batch = expected[start : start + BATCH_SIZE]
            vectors = await asyncio.to_thread(embedder.embed, [item.chunk.text for item in batch])
            points = []
            for item, vector in zip(batch, vectors):
                chunk = item.chunk
                document = item.document
                chunk.qdrant_id = item.point_id
                chunk.embedding_model = settings.embedding_model
                chunk.embedding_dimension = len(vector)
                points.append(
                    PointStruct(
                        id=item.point_id,
                        vector=vector,
                        payload={
                            "document_id": str(document.id),
                            "user_id": str(document.user_id) if document.user_id else None,
                            "chunk_index": chunk.chunk_index,
                            "page_number": chunk.page_number,
                            "text": chunk.text,
                            "domain": document.domain,
                            "entities": [],
                            "chunk_type": "base",
                            "embedding_model": settings.embedding_model,
                            "embedding_dimension": len(vector),
                            "collection_version": settings.qdrant_collection_version,
                        },
                    )
                )
            client.upsert(collection_name=settings.qdrant_collection, points=points)
            await db.commit()
            log.info("Reindexed %d/%d chunks", min(start + len(batch), len(expected)), len(expected))


async def main(recreate: bool) -> int:
    expected = await load_chunks()
    if recreate:
        await rebuild(expected)
    report = await consistency_report(expected)
    print(report)
    return 0 if report["missing_points"] == 0 and report["orphan_points"] == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="Delete and rebuild the configured collection from PostgreSQL chunks",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.recreate)))
