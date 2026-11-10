# Verity V2 - Phase 4 Durable File Storage

## Scope

Uploaded originals are now stored behind a storage adapter instead of being
treated as disposable container files. Local storage remains the default for
development. Production can use Cloudflare R2 or any S3-compatible provider.

## Changes implemented

- Added local and S3-compatible object storage adapters.
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

## Production setup

Set `STORAGE_BACKEND=s3` and configure the bucket, endpoint, access key, and
secret key. For local development, keep `STORAGE_BACKEND=local` and choose a
persistent `STORAGE_DIR`.

The S3 adapter is intentionally compatible with R2 and MinIO. Credentials must
be supplied through deployment secrets, never committed to the repository.

## Validation

```text
Storage adapter tests: pass
Python compile: pass
Migration head: a7b8c9d0e1f2
```
