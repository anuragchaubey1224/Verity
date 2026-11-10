# Deploying Verity (free tier)

Verity runs on a best-of-free managed stack. Each push to `main` auto-deploys.

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend (Next.js) | **Vercel** | auto-deploys on push |
| Backend + Celery worker | **Hugging Face Spaces** (Docker) | one container; auto-deployed via GitHub Action |
| PostgreSQL | **Neon** | serverless, scale-to-zero |
| Vector DB | **Qdrant Cloud** | free 1 GB cluster |
| Redis (Celery broker) | **Upstash** | `rediss://` TLS |
| LLM | **OpenRouter** | `:free` models |

```
Vercel (frontend) ──HTTP──> HF Space (FastAPI + Celery)
                                  ├──> Neon         (Postgres + FTS)
                                  ├──> Qdrant Cloud (vectors)
                                  ├──> Upstash      (Celery broker)
                                  └──> OpenRouter   (LLM)
```

---

## 1. Prerequisites

Create accounts and collect these values:

| Value | From |
|-------|------|
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `POSTGRES_URL` | Neon → connection string (paste raw; the app converts to asyncpg + TLS) |
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant Cloud → cluster endpoint + API key |
| `REDIS_URL` | Upstash → Redis database (the `rediss://…` URL) |

---

## 2. Backend → Hugging Face Space

1. Create a **Docker** Space at huggingface.co (name e.g. `verity-backend`).
2. In the Space → **Settings → Variables and secrets**, add these **secrets**:

   | Secret | Value |
   |--------|-------|
   | `OPENROUTER_API_KEY` | from OpenRouter |
   | `POSTGRES_URL` | from Neon |
   | `QDRANT_URL` | from Qdrant Cloud |
   | `QDRANT_API_KEY` | from Qdrant Cloud |
   | `REDIS_URL` | from Upstash |
   | `JWT_SECRET_KEY` | generate with `openssl rand -hex 32` |
   | `CORS_ORIGINS` | your Vercel URL (set after step 3) |
   | `APP_ENV` | `production` |

3. Set up auto-deploy from GitHub — in the **GitHub repo → Settings → Secrets and variables → Actions**:
   - **Secret:** `HF_TOKEN` — a Hugging Face *write* token (huggingface.co → Settings → Access Tokens)
   - **Variable:** `HF_USERNAME` — your HF username
   - **Variable:** `HF_SPACE_NAME` — the Space name (e.g. `verity-backend`)

   The workflow `.github/workflows/deploy-hf.yml` then pushes the backend to the
   Space on every backend change (or run it manually via *Actions → Run workflow*).

4. The Space URL is `https://<HF_USERNAME>-<HF_SPACE_NAME>.hf.space`.
   Verify: open `/<that URL>/health` → `{"status":"ok"}` and `/docs` for the API.

---

## 3. Frontend → Vercel

1. Import the GitHub repo in Vercel. Set **Root Directory** to `frontend`.
2. Add an environment variable:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://<HF_USERNAME>-<HF_SPACE_NAME>.hf.space` |

3. Deploy. Copy the resulting Vercel URL and set it as `CORS_ORIGINS` on the HF
   Space (step 2), then restart the Space.

---

## 4. Environment variables reference

Backend (HF Space secrets):

```
OPENROUTER_API_KEY=sk-or-...
POSTGRES_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
QDRANT_URL=https://xxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=...
REDIS_URL=rediss://default:pass@xxx.upstash.io:6379
JWT_SECRET_KEY=replace-with-a-long-random-secret
CORS_ORIGINS=https://your-app.vercel.app
APP_ENV=production
# optional
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
FAST_LLM_MODEL=google/gemma-3-4b-it:free
```

Frontend (Vercel): `NEXT_PUBLIC_API_URL=https://<HF_USERNAME>-<HF_SPACE_NAME>.hf.space`

---

## 5. How auto-deploy works

- **Frontend:** Vercel rebuilds on every push to `main` (native Git integration).
- **Backend:** the GitHub Action pushes the repo to the HF Space, which rebuilds
  the Docker image; `deploy/hf/start.sh` runs `alembic upgrade head`, starts the
  Celery worker and Uvicorn as supervised siblings, and exits non-zero if either
  dies so the platform restarts the container.

So after the initial setup, **`git push` → both frontend and backend update.**

---

## 6. Keeping free-tier services awake

Free HF Spaces **sleep after ~48h of inactivity**, and a Space that has been
idle for a long time can fail to schedule on wake (HF returns `503: Your space is
in error`). Neon also suspends its compute, and Qdrant Cloud can pause idle
clusters.

Use two layers:

1. **External uptime monitor (primary).** Create a free monitor (Better Stack,
   UptimeRobot, or cron-job.org) that sends `GET` to
   `https://<HF_USERNAME>-<HF_SPACE_NAME>.hf.space/health` every **5–10 minutes**.
   This is more reliable than GitHub's scheduler.
2. **GitHub Actions backup.** `.github/workflows/keep-alive.yml` pings the same
   endpoint every 30 minutes. It requires the repository variables
   `HF_USERNAME` and `HF_SPACE_NAME`.

Health endpoints:

| Endpoint | Checks | Use |
|---|---|---|
| `/health/live` | process only | container liveness |
| `/health` | process + Qdrant | keep-alive / uptime monitor |
| `/health/ready` | Postgres + Qdrant + Redis | full readiness (`503` if degraded) |

`/health` intentionally does **not** touch Postgres: pinging Neon 24/7 would
exceed the free compute-hour allowance. Neon's scale-to-zero cold start is short;
the frontend retries cold-start failures with backoff and a "waking up" message.

> **Known limitation:** the HF container's filesystem is ephemeral. Uploaded
> files under `data/uploads/` are lost on restart/rebuild; chunks and vectors
> remain in Postgres/Qdrant. Move originals to S3/R2 if you need re-ingestion
> from the source file.

> **Security note:** never reuse credentials copied into local `.env` files,
> shell history, screenshots, or logs. Rotate provider keys before deploying
> a new environment.
