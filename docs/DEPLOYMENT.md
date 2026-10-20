<!-- generated-by: gsd-doc-writer -->
# Deployment Guide

This guide details the deployment architecture, hosting targets, build pipelines, environment configuration, and rollback procedures for KD-IOMS.

## Deployment Targets

KD-IOMS is designed to run in a decoupled cloud environment:

```mermaid
graph LR
    User["End User Browser"]
    Vercel["Frontend Host\n(Vercel Next.js Edge / Serverless)"]
    Render["Backend API Host\n(Render Node.js Web Service)"]
    SupabaseDB[("Database Host\n(Supabase PostgreSQL 15+)")]
    SupabaseStore[("Asset Storage\n(Supabase S3-Compatible Buckets)")]

    User -->|HTTPS| Vercel
    Vercel -->|Rewrites /api/v1/*| Render
    Render -->|PostgreSQL Wire (SSL)| SupabaseDB
    Render -->|Signed URLs / Uploads| SupabaseStore
```

| Component | Target Platform | Runtime / Base | Build & Start Commands |
| :--- | :--- | :--- | :--- |
| **Backend API** | Render Web Service <!-- VERIFY: {Render Web Service hosting tier and region} --> | Node.js 20 ESM | **Build**: `npm run build:backend`<br>**Start**: `node backend/dist/server.js` |
| **Frontend Web** | Vercel <!-- VERIFY: {Vercel project framework configuration} --> | Next.js 16 (Node.js 20) | **Build**: `npm run build:frontend`<br>**Start**: `next start` |
| **Database** | Supabase | PostgreSQL 15+ | **Migration**: `npm run db:migrate` |
| **Storage Buckets**| Supabase Storage | S3-Compatible Object Store | Buckets: `invoices`, `delivery-photos` |

## Build Pipeline (CI/CD)

Continuous integration is enforced via GitHub Actions (`.github/workflows/ci.yml`).

### Verification Workflow

On every push or pull request targeting `main`, `dev1`, `dev2`, or `dev3`, GitHub Actions executes:

1. **Checkout & Runtime Setup**: Checks out repository code and provisions Node.js 20.
2. **Dependency Installation**: Runs `npm ci` across the monorepo.
3. **Enum Contract Check**: Executes `npm run sync-enums:check` to ensure frontend enums have not diverged from backend definitions.
4. **Static Typechecking**: Runs `npm run lint --workspace=backend` (`tsc --noEmit`).
5. **Frontend Linting**: Runs `npm run lint --workspace=frontend` (`eslint`).
6. **Backend Test Suite**: Runs `npm run test --workspace=backend` (`vitest run`).
7. **Frontend Test Suite**: Runs `npm run test --workspace=frontend` (`vitest run`).

### Production Deployment Flow

<!-- VERIFY: {Automated Git push hooks trigger Render and Vercel deployments upon merge into main} -->
When code is merged into `main` after passing the CI verify workflow:
1. **Render** detects changes in `backend/` and triggers a blue-green build deployment.
2. **Vercel** detects changes in `frontend/` and produces an optimized production deployment.
3. Database migrations (`npm run db:migrate`) must be executed against the production database before new backend releases are finalized.

## Environment Setup

Production deployment requires setting the necessary environment variables in your hosting provider's secrets management console. Refer to [Configuration Reference](CONFIGURATION.md) for full descriptions.

### Production Backend Environment (Render)

Configure the following secrets in the Render Dashboard:

```ini
NODE_ENV=production
PORT=5000
APP_ORIGIN=https://kd-ioms.vercel.app <!-- VERIFY: {Production frontend custom domain} -->
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
JWT_ACCESS_SECRET=[GENERATE_SECURE_64_CHAR_HEX_KEY]
JWT_REFRESH_SECRET=[GENERATE_SECURE_64_CHAR_HEX_KEY]
COOKIE_SECRET=[GENERATE_SECURE_RANDOM_STRING]
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
LOG_LEVEL=info
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SUPABASE_SERVICE_ROLE_KEY]
SUPABASE_STORAGE_BUCKET=invoices
SUPABASE_DELIVERY_BUCKET=delivery-photos
```

### Production Frontend Environment (Vercel)

Configure the following environment variable in the Vercel Dashboard:

```ini
BACKEND_URL=https://kd-ioms-api.onrender.com <!-- VERIFY: {Production Render backend service URL} -->
```

Next.js route rewrites in `frontend/next.config.ts` route all browser calls to `/api/v1/*` across the internal network to the Render URL.

## Database Migrations in Production

Database schema updates are managed by the standalone migration runner (`backend/src/db/migrate.ts`):

1. Migrations are executed in alphabetical order from `backend/migrations/*.sql`.
2. Applied migrations are recorded in the `schema_migrations` table.
3. Migrations execute inside single SQL transactions (`BEGIN ... COMMIT`) to prevent partial failure.

To run migrations against the production database:

```bash
# Set DATABASE_URL to your production connection string
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require" npm run db:migrate
```

> **Important**: Never write destructive migrations (e.g. `DROP COLUMN`) without a backwards-compatible transitional release, allowing both old and new backend instances to operate concurrently during rollouts.

## Rollback Procedure

If an issue is detected following a deployment:

### 1. Frontend Rollback (Vercel)
Vercel keeps immutable deployment artifacts:
1. Open the **Deployments** tab in the Vercel dashboard.
2. Locate the previous healthy deployment.
3. Click **Instant Rollback** to redirect traffic immediately.

### 2. Backend Rollback (Render)
1. In the Render Dashboard, navigate to the backend service.
2. Under **Events / Deploys**, select the previous successful build.
3. Click **Rollback to this deploy**.

### 3. Database Migration Rollback
If a schema migration must be rolled back:
1. Identify the failing migration file in `backend/migrations/`.
2. Author and test a compensatory forward migration SQL script (e.g. `006_revert_feature.sql`).
3. Apply the migration using `npm run db:migrate`.
4. Avoid manual manual deletion of records from `schema_migrations` in production.

## Monitoring & Health Checks

### Liveness Probe

Render probes the service using HTTP GET:
```bash
GET /api/v1/health
```
A 200 OK response with `status: "pass"` indicates both the Node.js event loop and the PostgreSQL connection pool are healthy. If the database is unreachable, it returns a 503 Service Unavailable response.

### Render Free-Tier Keep-Warm Ping

<!-- VERIFY: {External uptime monitor URL or cron ping service} -->
If hosted on Render's free tier, spinning down after 15 minutes of inactivity can be prevented by configuring an external ping service (such as UptimeRobot or Cron-Job.org) to ping `/api/v1/health` every 10 minutes.

### Structured Logging

All requests, slow queries (>500ms), and uncaught exceptions are logged in structured JSON using Pino to `stdout`. Hosting platforms (Render, CloudWatch, Datadog) ingest these JSON logs for alerting and log querying.
