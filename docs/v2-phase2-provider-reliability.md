# Verity V2 - Phase 2 Provider Reliability

## Scope

Phase 2 bounds external provider calls and fails readiness checks when the
configured Qdrant collection is missing or has an incompatible vector schema.
This prevents provider outages from hanging requests indefinitely and makes
misconfigured infrastructure visible during deployment.

## Changes implemented

- Added configurable connection/request timeouts for PostgreSQL, Qdrant,
  Redis, LLM, and web-search calls.
- Added bounded OpenRouter retries for transient LLM failures.
- Added Redis socket timeouts and retry-on-timeout behavior.
- Added Qdrant collection schema validation for vector dimension and distance.
- Made Qdrant readiness fail when the configured collection is unavailable or
  incompatible.
- Added explicit warnings when Qdrant payload indexes cannot be created.
- Documented the provider settings in `.env.example` and `DEPLOYMENT.md`.

## Validation

The focused provider configuration and existing health/retrieval tests pass:

```text
7 passed
```

The full backend suite and Python compilation must pass before this phase is
committed and pushed.

## Operational notes

Set timeout values according to the provider and deployment platform. Keep
them finite in production. A Qdrant collection created by an earlier version
must use the configured embedding dimension and cosine distance; incompatible
collections should be migrated or recreated deliberately rather than silently
used.
