# TMOD Smart Employee Deployment

This folder contains the first production deployment baseline for `TMOD智能员工`.

## Deployment Modes

- `systemd + nginx`: suitable for one small cloud VM.
- `docker compose`: suitable for a VM where Postgres, Redis, API, worker, and frontend run together.
- `k8s`: suitable for a managed Kubernetes cluster after the product has stable traffic and operations support.

## Minimal VM Checklist

1. Install Python 3.11+, Node.js 20+, PostgreSQL 15+, Redis 7+, Nginx.
2. Create `/opt/tmod-smart-employee` and copy the repository there.
3. Copy `review_platform/server/.env.example.production` to `/etc/tmod-smart-employee/server.env`.
4. Edit all secrets, domain names, CORS origins, Dify keys, database URLs, and Redis URLs.
5. Build the frontend and copy `review_platform/frontend/dist` to `/var/www/tmod-smart-employee`.
6. Install and enable the systemd services.
7. Install the Nginx site and reload Nginx.
8. Run `deploy/scripts/smoke_test.sh https://your-domain.example`.

## Services

- API: FastAPI app, HTTP port `8000`.
- Worker: Celery worker, consumes Redis queue and executes business-line runs.
- Database: PostgreSQL for users, run metadata, candidates, events, and artifact records.
- Artifact files: local disk by default; switch `ARTIFACT_STORAGE_BACKEND=s3` for S3-compatible storage.

## Database Migration

Run migrations from `review_platform/server`:

```bash
alembic upgrade head
```

For local SQLite development, the app still creates missing tables automatically and applies a lightweight compatibility update for newly added run archive/delete columns.

## Celery Worker

Set:

```bash
RUN_EXECUTION_BACKEND=celery
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

Then start:

```bash
celery -A app.worker.celery_app.celery_app worker --loglevel=INFO --concurrency=2
```

Leave `RUN_EXECUTION_BACKEND=thread` for single-machine local trials.

## Object Storage

Set:

```bash
ARTIFACT_STORAGE_BACKEND=s3
S3_BUCKET_NAME=your-bucket
S3_REGION_NAME=us-east-1
S3_ENDPOINT_URL=https://s3-compatible-endpoint.example
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
```

Generated artifacts are still produced locally by the business line, then uploaded by the platform artifact store. Downloads and QA report reads use S3 automatically after upload.

## Docker Compose

From `deploy/docker`:

```bash
docker compose up --build
```

The frontend will be available at `http://localhost:8080`.

## Kubernetes

Build and push the two images referenced in `deploy/k8s/05-app.yaml` and `deploy/k8s/06-web.yaml`, then apply:

```bash
kubectl apply -f deploy/k8s/00-namespace.yaml
kubectl apply -f deploy/k8s/01-configmap.yaml
kubectl apply -f deploy/k8s/02-secret.example.yaml
kubectl apply -f deploy/k8s/
```

Before applying in production, copy `02-secret.example.yaml` to a real secret manifest or create the secret through your cloud secret manager.

## Backups

The included backup script covers local SQLite and local artifact files. For PostgreSQL, use managed database backups or `pg_dump` from your DB host. For S3/MinIO, enable bucket versioning or provider backups.

## Smoke Test

`deploy/scripts/smoke_test.sh` checks:

- Frontend root returns HTTP success.
- API health returns HTTP success.

It does not submit a real review task because that requires a valid Excel source file and Dify credentials.
