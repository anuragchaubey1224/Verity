import asyncio
import logging
import uuid
from datetime import datetime, timezone

from backend.workers.celery_app import celery_app

log = logging.getLogger("verity.workers.tasks")


async def _update_job(
    job_id: str | None,
    *,
    status: str,
    task_id: str | None = None,
    document_id: str | None = None,
    error: str | None = None,
    attempts: int | None = None,
) -> None:
    if not job_id:
        return

    from sqlalchemy import select
    from backend.db.models.ingestion_job import IngestionJob
    from backend.db.postgres import WorkerSessionLocal

    async with WorkerSessionLocal() as db:
        job = await db.scalar(select(IngestionJob).where(IngestionJob.id == uuid.UUID(job_id)))
        if not job:
            log.error("[task] ingestion job not found | job_id=%s", job_id)
            return
        job.status = status
        if status in {"running", "completed"}:
            job.error = None
        if task_id:
            job.celery_task_id = task_id
        if document_id:
            job.document_id = uuid.UUID(document_id)
        if error:
            job.error = error[:4000]
        if attempts is not None:
            job.attempts = attempts
        if status in {"completed", "failed"}:
            job.completed_at = datetime.now(timezone.utc)
        await db.commit()


@celery_app.task(
    name="ingest_document",
    bind=True,
    max_retries=3,
    acks_late=True,
    reject_on_worker_lost=True,
)
def ingest_document_task(
    self,
    source: str,
    title: str,
    domain: str | None = None,
    user_id: str | None = None,
    job_id: str | None = None,
) -> dict:
    """Background task — parse, chunk, embed, and store a document."""
    log.info("[task] ingest_document started | title=%r | source=%s", title, source)

    async def _run() -> dict:
        from backend.db.postgres import WorkerSessionLocal
        from backend.db.qdrant_client import init_collection
        from backend.ingestion.pipeline import ingest_document

        init_collection()
        async with WorkerSessionLocal() as db:
            doc = await ingest_document(source=source, title=title, db=db, domain=domain, user_id=user_id)
            return {"document_id": str(doc.id), "title": doc.title, "status": doc.status}

    attempts = self.request.retries + 1
    try:
        asyncio.run(_update_job(job_id, status="running", task_id=self.request.id, attempts=attempts))
        result = asyncio.run(_run())
        asyncio.run(
            _update_job(
                job_id,
                status="completed",
                document_id=result["document_id"],
                attempts=attempts,
            )
        )
        log.info("[task] ingest_document done | document_id=%s", result["document_id"])
        return result
    except Exception as exc:
        if self.request.retries < self.max_retries:
            asyncio.run(
                _update_job(
                    job_id,
                    status="retrying",
                    task_id=self.request.id,
                    error=str(exc),
                    attempts=attempts,
                )
            )
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        asyncio.run(
            _update_job(
                job_id,
                status="failed",
                task_id=self.request.id,
                error=str(exc),
                attempts=attempts,
            )
        )
        log.exception("[task] ingest_document failed | job_id=%s", job_id)
        raise


@celery_app.task(name="ingest_text", bind=True)
def ingest_text_task(
    self,
    text: str,
    title: str,
    source_url: str = "",
    domain: str | None = None,
    user_id: str | None = None,
    job_id: str | None = None,
) -> dict:
    """Background task — ingest raw text (e.g. from web search) into the KB."""
    log.info("[task] ingest_text started | title=%r", title)

    async def _run() -> dict:
        import tempfile, os
        from backend.db.postgres import WorkerSessionLocal
        from backend.db.qdrant_client import init_collection
        from backend.ingestion.pipeline import ingest_document

        init_collection()

        # Write text to a temp .txt file so the pipeline can handle it
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(f"Source: {source_url}\n\n{text}")
            tmp_path = f.name

        try:
            async with WorkerSessionLocal() as db:
                doc = await ingest_document(source=tmp_path, title=title, db=db, domain=domain, user_id=user_id)
                return {"document_id": str(doc.id), "status": doc.status}
        finally:
            os.unlink(tmp_path)

    result = asyncio.run(_run())
    log.info("[task] ingest_text done | document_id=%s", result["document_id"])
    return result
