#!/usr/bin/env bash
# Entrypoint for the Hugging Face Space: migrate -> celery worker + uvicorn.
#
# Both processes are supervised: if either dies the container exits non-zero so
# the platform restarts it. Previously Celery was orphaned in the background —
# the Space stayed "healthy" while async ingestion was silently dead.
set -euo pipefail

echo "[start] applying database migrations..."
# Retry briefly for a waking Neon compute, then fail fast. Booting against a
# stale schema is worse than a visible startup error.
for attempt in 1 2 3; do
  if alembic upgrade head; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "[start] FATAL: alembic upgrade failed after 3 attempts" >&2
    exit 1
  fi
  echo "[start] migration attempt $attempt failed — retrying in 5s..."
  sleep 5
done

echo "[start] launching Celery worker (solo pool)..."
celery -A backend.workers.celery_app worker --loglevel=info -P solo &
CELERY_PID=$!

echo "[start] launching Uvicorn on :7860..."
uvicorn main:app --host 0.0.0.0 --port 7860 &
UVICORN_PID=$!

shutdown() {
  echo "[start] shutting down..."
  kill -TERM "$CELERY_PID" "$UVICORN_PID" 2>/dev/null || true
}
trap shutdown TERM INT

# Wait for whichever process exits first, then stop the other and let the
# platform restart the container.
set +e
wait -n "$CELERY_PID" "$UVICORN_PID"
EXIT_CODE=$?
set -e

echo "[start] a supervised process exited (code=$EXIT_CODE) — restarting container" >&2
shutdown
wait || true
exit 1
