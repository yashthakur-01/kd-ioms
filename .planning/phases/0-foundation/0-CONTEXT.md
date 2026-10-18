# Phase 0 Context: Foundation

**Phase:** Phase 0 — Foundation  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`, Reviewers: `dev2`, `dev3`)**  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 0`)  
**Primary Requirements Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 5  

---

## 1. Phase Objective & Boundary

Establish an empty but completely deployable and verified system baseline where all subsequent modules plug into the same architectural foundation:
- Standardized JSON response envelope and typed error handling.
- Structured Pino logging with `AsyncLocalStorage` request tracing (`X-Request-Id`).
- Supabase PostgreSQL connection pool with transaction retry and ordered row-locking helpers.
- Baseline schema migration `001_init.sql` (schema v1.1) containing all core domain tables, triggers, functions, and views.
- Express backend application scaffolding in TypeScript (`backend/src/**/*.ts`).
- Next.js frontend application scaffolding in TypeScript (`frontend/src/**`) with App Router, Tailwind CSS, TanStack Query, React Hook Form, and standard API client.
- Root repository orchestration scripts and automated GitHub Actions CI pipeline.

---

## 2. Locked Implementation Decisions

### 2.1 Backend Architecture & Language
- **Language & Execution:** Node.js + Express written in **TypeScript** (`backend/src/**/*.ts`).
- **Development Runner:** `tsx watch src/server.ts` for fast, zero-transpile local development with live reload.
- **Production Build:** `tsc` compiling to `backend/dist/`, running via `node dist/server.js`.
- **Layer Isolation:** Strict adherence to `routes/` -> `middleware/` (`request-id`, `access-log`, `validate`, `authenticate`, `authorize`, `error-handler`) -> `controller` -> `service` -> `db`.
- **Standard Envelope:** Responses formatted exclusively through `src/utils/response.ts` (`ok`, `created`, `okList`, `fail`). No direct `res.json()`.
- **Error Handling:** Centralized `AppError` hierarchy (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `ExternalServiceError`) with PostgreSQL code translation (`utils/db-error-map.ts`).
- **Pino Structured Logger:** Logs NDJSON with `ts`, `level`, `requestId`, `userId`, `role`. Sensitive fields (passwords, tokens, cookies, auth bodies) strictly redacted.

### 2.2 Database & Supabase Environment
- **Environment Strategy:** **Supabase is used for both local development and production environments.**
- **Connection & Pooling:** `pg.Pool` initialized with `DATABASE_URL` (SSL configured, max 10 connections for pooled access, query duration logging >500ms).
- **Transactions:** `withTransaction(fn, { retries: 2 })` handling automatic rollback on errors and retry on PostgreSQL serialization failures (`40001`) and deadlocks (`40P01`).
- **Deadlock Prevention:** Pre-defined ordered locking helpers (`lockMedicines(tx, ids)`, `lockBatches(tx, ids)`) sorting IDs in ascending order.
- **Migration Runner:** Standalone migration runner script `src/db/migrate.ts` executing numbered migrations sequentially against `schema_migrations`.
- **Baseline Migration (`001_init.sql`):** Comprehensive schema baseline v1.1 defining:
  - Custom types and enums (`user_role`, `approval_status`, `order_status`, `fulfilment_status`, `delivery_item_status`, `batch_status`, `ledger_entry_type`, `capture_method`, `notification_channel`, `notification_status`).
  - Core tables (`users`, `auth_sessions`, `retailer_profiles`, `salts`, `medicines`, `batches`, `stock_ledger_entries`, `orders`, `order_items`, `order_allocations`, `order_status_history`, `invoices`, `notification_logs`, `app_settings`, `document_sequences`).
  - Database functions: `today_ist()`, `next_document_number(seq_code)`.
  - Database triggers: `salts_text` synchronization trigger on medicine/salt updates, `allocations_check_rules` trigger on pick insertions.
  - Database views: `v_catalog`, `v_medicine_availability`, `v_expiry_alerts`, `v_expired_stock`.

### 2.3 Frontend Strategy & Design System
- **Framework:** Next.js App Router with TypeScript.
- **Styling:** Tailwind CSS with mobile-first responsive utility tokens.
- **Component Primitives:** **Lightweight custom Tailwind CSS components** using clean native HTML semantics + Tailwind tokens (as specified in `tech.md` Section 4.1):
  - `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `Toast`, `Spinner`, `EmptyState`, `Pagination`, `ConfirmDialog`, `FormField`.
- **State & Query:** `@tanstack/react-query` configured with `QueryProvider` and zero optimistic updates for stock mutations.
- **Forms:** `react-hook-form` with `@hookform/resolvers/zod`.
- **API Client:** `src/lib/api/client.ts` with `apiFetch`, automatic JWT handling, silent refresh retry on `AUTH_TOKEN_EXPIRED`, error envelope mapping into `ApiError`, and `X-Request-Id` capture.
- **Proxy Rewrite:** `next.config.ts` rewriting `/api/v1/:path*` to `BACKEND_URL` for same-origin cookie management.
- **Empty Role Layouts:** Route groups `(auth)`, `(admin)`, `(retailer)`, `(delivery)` with basic navigation shells and responsive layouts (bottom nav on mobile).

### 2.4 Monorepo Scripts & Shared Operations
- **Root Orchestration:** Root-level `package.json` with npm workspaces or parallel script execution:
  - `npm run dev`: Concurrently runs backend (`tsx watch`) and frontend (`next dev`).
  - `npm run build`: Builds both backend (`tsc`) and frontend (`next build`).
  - `npm test`: Runs backend test suite and frontend component tests.
  - `npm run lint`: Runs ESLint and Prettier across all workspaces.
  - `npm run db:migrate`: Executes the migration runner against `DATABASE_URL`.
  - `npm run sync-enums`: Script syncing backend enums to frontend (`src/lib/enums/`).
- **CI Pipeline:** GitHub Actions workflow executing on pull requests:
  - Workspace linting and format checking.
  - TypeScript compilation check (`tsc --noEmit`).
  - Backend and frontend automated tests.
  - Enum synchronization drift verification.

---

## 3. Automated Test Suite for Phase 0

1. **Unit Tests (Backend):**
   - `config/env.test.ts`: Process exits with status 1 on missing `DATABASE_URL` or `JWT_ACCESS_SECRET`.
   - `utils/money.test.ts`: `toPaise('100.80')` -> `10080`, `fromPaise(10080)` -> `'100.80'`, GST addition and `roundHalfUp`.
   - `utils/dates.test.ts`: `todayIst()` correctly returns India Standard Time date `YYYY-MM-DD`.
   - `db/transaction.test.ts`: `withTransaction` rolls back on thrown error and retries on `40001`/`40P01`.
   - `middleware/error-handler.test.ts`: Stack traces and raw SQL strings are sanitized from error envelopes.
2. **Integration Tests (Backend):**
   - `GET /api/v1/health`: Returns 200 with standard envelope `{ success: true, code: "HEALTH_OK", data: { status: "ok", db: "up" }, meta: { requestId, timestamp } }`.
   - `GET /api/v1/health` with simulated DB failure: Returns 503 with standard envelope and code `DB_DOWN`.
   - Unknown route `GET /api/v1/non-existent`: Returns 404 envelope with code `NOT_FOUND`.
   - Malformed JSON body on write: Returns 400 envelope with code `VALIDATION_ERROR`.
3. **Frontend Tests:**
   - `lib/api/client.test.ts`: Successful response extracts envelope `data`; failed response throws typed `ApiError` with `requestId`.
   - Role layout rendering and Next.js health proxy verification.

---

## 4. Phase Exit Criteria ("Done When")

- [ ] `GET /api/v1/health` returns standard envelope via the frontend origin rewrite (`localhost:3000/api/v1/health`).
- [ ] Migrations (`001_init.sql`) execute cleanly on the Supabase database and create all required tables, triggers, and views.
- [ ] Deliberately triggering an error displays the reference ID (`Ref: <requestId>`) in the frontend toast notification and matches the backend structured log entry.
- [ ] CI workflow runs and passes typecheck, lint, and automated test suites.
- [ ] Enum synchronization script (`sync-enums`) confirms parity between backend and frontend enums.
