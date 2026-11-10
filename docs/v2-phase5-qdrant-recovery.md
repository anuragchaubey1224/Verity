# Verity V2 - Phase 5 Qdrant Durability and Recovery

## Changes implemented

- Added deterministic Qdrant point IDs derived from PostgreSQL chunk UUIDs.
- Added embedding model, dimension, and logical collection-version metadata.
- Added PostgreSQL chunk metadata for the embedding used at index time.
- Added `scripts/reindex_qdrant.py` for read-only consistency audits.
- Added explicit `--recreate` rebuild mode that recreates the collection from
  PostgreSQL chunks and re-embeds them in bounded batches.
- Added reporting for missing and orphan Qdrant points.

## Recovery procedure

Run the read-only audit first:

```bash
python -m scripts.reindex_qdrant
```

For an empty or deleted collection, rebuild it:

```bash
python -m scripts.reindex_qdrant --recreate
```

The rebuild is idempotent because point IDs are deterministic. PostgreSQL
remains the metadata/chunk source of truth; Qdrant is a derived index.
