# Verity V2 — Phase 0 Baseline Audit

Audit date: 2026-11-10

## Reference versions

| Reference | Revision | Status |
|---|---|---|
| V1 branch | `3e08b5e` | Frozen at `origin/v1` |
| V1 tag | `v1.0-resume` | Frozen benchmark reference |
| V2 branch | `main` | Active development branch |

At the start of Phase 0, `main` and `v1` point to the same clean commit. The
V1 tag remains available for interview reproduction and must not be rewritten
as part of V2 work.

## Verified baseline

### Version and worktree

- `main` tracks `origin/main`.
- `v1` tracks `origin/v1`.
- `v1.0-resume` points to the frozen V1 commit.
- No worktree changes were present before this Phase 0 documentation update.
- `interview_docs/` remains ignored and is not part of the public repository.

### Architecture and deployment

Current runtime topology:

```text
Frontend
  → FastAPI backend
      → PostgreSQL
      → Qdrant
      → Redis
      → OpenRouter
  → Celery worker
```

The local Compose topology has six runtime services:

1. PostgreSQL
2. Qdrant
3. Redis
4. Backend
5. Celery worker
6. Frontend

The Hugging Face deployment currently starts the API and Celery worker in one
container. This is a known V2 decomposition target, not a V1 claim change.

### Database migrations

The migration graph was checked with Alembic and has one head:

```text
1b1de1ba0245
  → b2c3d4e5f6a7
  → c3d4e5f6a7b8
  → d4e5f6a7b8c9
  → e5f6a7b8c9d0 (head)
```

The current schema includes documents, chunks, PostgreSQL full-text search,
conversation history, users, and user-scoped documents/conversations.

### Validation results

| Check | Result | Notes |
|---|---|---|
| Python compile check | PASS | `python3 -m compileall -q backend main.py` |
| Alembic heads/history | PASS | One linear head: `e5f6a7b8c9d0` |
| Worktree diff check | PASS | No whitespace errors before this audit update |
| Backend pytest collection | BLOCKED | Local environment is missing `asyncpg`, `qdrant-client`, and `langchain-text-splitters` |
| Integration test coverage | GAP | `tests/integration/` currently contains only `__init__.py` |
| Frontend lint/build | PASS | Verified before Phase 0 audit on the V1 snapshot |

The pytest result is an environment/setup failure, not a passing test result.
Phase 1 must make dependency installation reproducible before test coverage is
expanded.

## Configuration contract

Required backend settings:

```text
OPENROUTER_API_KEY
POSTGRES_URL
QDRANT_URL
REDIS_URL
JWT_SECRET_KEY
```

Optional but deployment-relevant settings:

```text
QDRANT_API_KEY
QDRANT_COLLECTION
CORS_ORIGINS
APP_ENV
LLM_MODEL
FAST_LLM_MODEL
TAVILY_API_KEY
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
```

`.env` is ignored and must never be committed. Any provider credentials that
have been exposed in a local environment or terminal history must be rotated
before the next deployment. Credentials are intentionally not recorded in this
audit.

## Current gaps recorded for V2

### P0 — credentials

- Rotate any real local/provider credentials before deployment.
- Create fresh deployment secrets through provider dashboards.
- Confirm that logs, shell history, screenshots, and CI output do not contain
  credentials.

### P1 — reproducibility

- Python dependencies are currently unpinned.
- Local test collection depends on packages that are not installed in the
  current interpreter.
- Add a clean-environment install check in CI and document the supported
  Python/Node versions.

### P1 — provider reliability

- Qdrant availability, collection recreation, and schema validation need a
  recovery workflow.
- Redis currently supports Celery and rate limiting but has no durable job
  lifecycle or dead-letter workflow.
- PostgreSQL/Qdrant writes in ingestion are not one atomic transaction.

### P1 — durability and consistency

- Uploaded files use container-local storage and can be lost on restart.
- Qdrant is a derived index but there is no complete rebuild/reconciliation
  workflow.
- Ingestion jobs do not yet have a durable state machine.

### P1 — security and ownership

- Task ownership and cache isolation require additional audit/tests.
- Upload limits and content validation need to be explicit.
- Production CORS and JWT secret rotation need operational verification.

### P2 — operations

- API and Celery worker currently share the Hugging Face container.
- Request IDs, queue metrics, provider alerts, and failure dashboards are not
  complete.
- Integration and failure-injection test suites are not yet present.

## Phase 0 acceptance criteria

Phase 0 is complete when:

- [x] V1 branch and tag are frozen and verified.
- [x] `main` is confirmed as the V2 development branch.
- [x] Configuration and deployment surfaces are inventoried.
- [x] Migration graph has a single verified head.
- [x] Baseline validation results are recorded honestly.
- [x] V2 gaps are prioritized without changing V1 artifacts.
- [ ] Real provider credentials are rotated before deployment.
- [ ] Phase 1 reproducible dependency setup is complete.

The remaining unchecked items are operational follow-ups and are intentionally
not claimed as complete by this audit.

## Next phase

Phase 1 starts with dependency reproducibility and CI hardening:

1. Pin Python dependencies.
2. Validate frontend lockfile installation.
3. Create a clean test environment.
4. Make compile, lint, test, migration, and Docker checks explicit CI gates.
5. Re-run the baseline tests and record the result.
