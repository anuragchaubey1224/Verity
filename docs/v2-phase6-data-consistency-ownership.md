# Verity V2 - Phase 6 Data Consistency and Ownership

## Changes implemented

- Added an explicit owner check before document-scoped retrieval in both query
  paths.
- Kept task and job status lookups scoped to the authenticated user.
- Changed the in-memory conversation cache key to `(user_id, session_id)`.
- Added ownership and cache-isolation tests.

## Consistency model

PostgreSQL is the source of truth for users, documents, chunks, and ingestion
jobs. Qdrant is a derived index. The Phase 5 reindex command repairs any
inconsistency that remains after an infrastructure failure.

## Ownership guarantees

- Dense retrieval applies the authenticated user filter in Qdrant.
- Sparse retrieval joins documents and applies the authenticated user filter
  in PostgreSQL.
- Document-scoped retrieval rejects documents not owned by the caller.
- Conversation history queries and the process-local cache include the user
  identity.
- Async task/job status queries include the job owner.
