# Verity V2 - Phase 3 Durable Ingestion Jobs

## Scope

Phase 3 makes asynchronous ingestion status durable in PostgreSQL. Celery
remains the execution and retry transport, but the application no longer
depends on the Redis result backend to tell users whether ingestion succeeded.

## Changes implemented

- Added the `ingestion_jobs` table and SQLAlchemy model.
- Created a job row before publishing an asynchronous ingestion task.
- Persisted queued, running, retrying, completed, and failed states.
- Persisted retry attempts, terminal errors, completion time, and document ID.
- Added three bounded Celery retries with exponential backoff.
- Added durable status lookup by Celery task ID and persistent job ID.
- Scoped status queries to the authenticated owner.
- Marked queue publication failures as terminal job failures instead of leaving
  jobs permanently queued.

## Operational behavior

The job record is the source of truth for the API. Redis/Celery may lose
transient result metadata or restart, but the PostgreSQL job record remains
available for user-facing status and debugging. A failed job stores a bounded
error message and the number of attempts made.

## Validation

```text
Python compile: pass
Pytest: 17 passed
Migration chain: single head f6a7b8c9d0e1
```

Apply the migration before using asynchronous ingestion:

```bash
alembic upgrade head
```
