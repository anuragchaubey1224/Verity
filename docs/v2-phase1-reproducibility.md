# Verity V2 — Phase 1 Reproducibility Record

## Changes implemented

- Added `requirements.lock`, generated with `uv pip compile` for Python 3.12.
- Updated backend and Hugging Face Dockerfiles to install the lockfile.
- Updated CI to install the lockfile.
- Updated the README setup command to use the lockfile.
- Regenerated `frontend/package-lock.json` so clean `npm ci` succeeds.
- Added an explicit async pytest fixture loop scope in `pytest.ini`.
- Added CI checks for:
  - Python compilation
  - Alembic migration graph
  - Backend tests
  - Backend Docker image build
  - Docker Compose configuration
  - Frontend `npm ci`, lint, and build
- Added `requirements.lock` to the Hugging Face deployment trigger paths.

## Validation performed

### Clean Python environment

Created a temporary Python 3.12 virtual environment and installed only
`requirements.lock`.

Results:

```text
Alembic head: e5f6a7b8c9d0
Python compile: pass
Pytest: 13 passed
```

### Frontend lockfile

The previous lockfile failed `npm ci` because it was out of sync with
`package.json`. After regeneration:

```text
npm ci --dry-run: pass
```

The lockfile is now suitable for CI clean installs.

## Remaining Phase 1 verification

The CI workflow now contains the backend image and Compose checks. They must
also pass in GitHub Actions before Phase 1 is considered fully complete.

The local Python environment may still have the older unpinned packages
installed. Use a clean virtual environment or the Docker image for V2
validation; do not treat the host interpreter as the source of truth.

## Phase 1 exit criteria

- [x] Python lockfile generated and used by Docker/CI.
- [x] Frontend lockfile passes clean-install dry run.
- [x] Clean Python environment installs dependencies.
- [x] Clean Python environment passes compile, migration-head, and pytest checks.
- [x] CI gates added for migration, Docker, and Compose validation.
- [ ] GitHub Actions run passes all backend and frontend jobs.
