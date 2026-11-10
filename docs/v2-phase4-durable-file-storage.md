# Verity V2 - Phase 4 Durable File Storage

## Scope

Uploaded originals are stored behind a small local filesystem adapter instead
of being written using user-controlled filenames directly.

## Changes implemented

- Added a local filesystem storage adapter.
- Added upload size and extension validation.
- Added generated storage keys; user filenames are never used as object paths.
- Persisted original filename, content type, size, storage key, and SHA-256
  checksum on the document.
- Ingested uploads from temporary files and removed those temporary files in a
  `finally` block.
- Preserved the original object after successful ingestion for future
  re-ingestion.
- Allowed Celery workers to ingest `storage://...` sources by materializing
  objects into worker-local temporary files and cleaning them afterward.
- Cleaned up a newly stored object if ingestion fails before completion.

## Deployment trade-off

The local adapter keeps the free-tier deployment simple and requires no
additional storage credentials. Its originals are lost when the
container filesystem is recreated; PostgreSQL chunks and Qdrant vectors remain
available. Object storage can be added later if source-file recovery becomes
a real requirement.

## Validation

```text
Storage adapter tests: pass
Python compile: pass
Migration head: a7b8c9d0e1f2
```
