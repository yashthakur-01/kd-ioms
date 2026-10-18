# Plan 0-03: Backend Core Foundation, Standards, Middlewares & Health API

**Phase:** Phase 0 — Foundation  
**Plan ID:** `0-03`  
**Wave:** 3 (Backend Core Foundation)  
**Dependencies:** Plan `0-01`, Plan `0-02`  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`)**  

---

## 1. Objective

Implement the complete Express backend core architecture in TypeScript: environment validation, structured Pino logging with AsyncLocalStorage request tracing, standard response envelopes, custom error hierarchy, PostgreSQL error mapping, shared financial/date utilities, middleware pipeline, and the health check API (`GET /api/v1/health`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Environment & Configuration
- Create `backend/src/config/env.ts`:
  - Zod schema validating: `NODE_ENV`, `PORT` (default 5000), `LOG_LEVEL` (default 'info'), `APP_ORIGIN`, `DATABASE_URL`, `JWT_ACCESS_SECRET` (min 32 chars), `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_EXPIRES_IN` (default '15m'), `REFRESH_TOKEN_EXPIRES_IN` (default '7d'), `COOKIE_SECRET`, `COOKIE_SECURE` (boolean), `COOKIE_SAME_SITE` ('lax' | 'strict' | 'none').
  - Validates and freezes config object; on failure, prints formatted list of missing/invalid variables and exits process (`process.exit(1)`).
- Create `backend/src/config/index.ts` exporting typed configuration.

### Task 2: Logging & Request Context
- Create `backend/src/utils/request-context.ts`:
  - `AsyncLocalStorage` instance storing `{ requestId: string; actor?: { userId: string; role: string } }`.
  - Helper functions: `runWithContext(store, fn)`, `getRequestId()`, `getActor()`.
- Create `backend/src/config/logger.ts`:
  - Pino logger instance outputting structured NDJSON to stdout.
  - Automatic injection of `requestId`, `userId`, `role` from `request-context.ts`.
  - Redaction rules: `password`, `token`, `refreshToken`, `authorization`, `headers.cookie`, `phone`, `body.password`, `body.currentPassword`, `body.newPassword`.

### Task 3: Constants & Enums Re-export
- Create `backend/src/constants/error-codes.ts` declaring all `UPPER_SNAKE` codes (`VALIDATION_ERROR`, `AUTH_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `AUTH_ACCOUNT_LOCKED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_RESOURCE`, `INSUFFICIENT_STOCK`, `PRICE_EXCEEDS_MRP`, `RATE_LIMITED`, `INTERNAL_ERROR`, `DB_DOWN`, etc.).
- Create `backend/src/constants/success-codes.ts` (`HEALTH_OK`, `LOGIN_SUCCESS`, `ORDER_PLACED`, etc.).
- Create `backend/src/constants/limits.ts`, `regex.ts`, `settings-keys.ts`.

### Task 4: Standard Response Envelopes & Error Classes
- Create `backend/src/utils/response.ts`:
  - `ok(res, { code, message, data, meta })` -> HTTP 200
  - `created(res, { code, message, data, meta })` -> HTTP 201
  - `okList(res, { code, message, data, page, pageSize, totalItems, meta })` -> HTTP 200 with `meta.pagination`
  - Injects `meta.requestId` (from `getRequestId()`), `meta.timestamp` (ISO UTC).
- Create `backend/src/errors/app-error.ts`:
  - `AppError` base class (accepts `code`, `httpStatus`, `message`, `errors`, `cause`).
  - Subclasses: `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `BusinessRuleError` (422), `ExternalServiceError` (502).
- Create `backend/src/utils/db-error-map.ts`:
  - Converts PostgreSQL error codes (`23505` -> `DUPLICATE_RESOURCE`, `23503` -> 409 conflict, `23514` & trigger messages -> 422 business rule violations).

### Task 5: Pure Utilities (Money, Dates, Case, Crypto, Pagination, Validators)
- `src/utils/money.ts`:
  - `toPaise(val: string | number): number` (supports "100.80" -> 10080).
  - `fromPaise(paise: number): string` (returns two-decimal string "100.80").
  - `addGst(paise: number, gstRate: number): number`.
  - `roundHalfUp(n: number): number`.
- `src/utils/dates.ts`:
  - `todayIst(): string` (returns India date string `YYYY-MM-DD`).
  - `addDays(dateStr: string, days: number): string`.
  - `financialYearOf(dateStr: string): string` (returns e.g. "2026-27").
- `src/utils/case.ts`:
  - `toCamel(row: Record<string, any>): Record<string, any>`
  - `toCamelList(rows: Record<string, any>[]): Record<string, any>[]`
- `src/utils/crypto.ts`:
  - Password hashing and verification using `crypto` / `bcryptjs`.
  - Random 256-bit token generator and SHA-256 hash helper for refresh tokens.
- `src/utils/pagination.ts`:
  - `parsePagination(query: any)` returning `{ page, pageSize, offset, limit }`.
  - `buildOrderBy(sort: string | undefined, allowedFields: string[], defaultSort: string)`.
- `src/utils/validators.ts`:
  - Shared Zod fragments: `paginationQuery`, `nonEmptyText(min, max)`, `moneyString`, `quantity`, `isoDate`, `phoneE164`, `username`, `password`.

### Task 6: Middleware Chain
- `src/middleware/request-id.ts`: generates UUID or adopts `X-Request-Id`, sets response header, initializes request context.
- `src/middleware/access-log.ts`: logs single JSON access log line upon response finish (`durationMs`, `method`, `path`, `status`, `code`).
- `src/middleware/rate-limit.ts`: general rate limiter (300 req/min per IP) and write limiter.
- `src/middleware/validate.ts`: validates `{ body, query, params }` using `.strict()` Zod schemas, sets `req.valid`, throws `ValidationError` with details array.
- `src/middleware/async-handler.ts`: wraps async controller functions to pass unhandled rejections to `next()`.
- `src/middleware/not-found.ts`: 404 handler returning standard error envelope.
- `src/middleware/error-handler.ts`: global error middleware; logs error, sends appropriate envelope with HTTP status, sanitizes SQL statements and stack traces on 500 errors.

### Task 7: Express App, Routes & Health Endpoint
- `src/routes/index.ts`: mounts module routes under `/api/v1`.
- `src/modules/health/`:
  - `health.route.ts`: `GET /health` mapped to controller.
  - `health.controller.ts`: calls service, returns `ok(res, ...)`.
  - `health.service.ts`: runs `SELECT 1` against pool; returns `{ status: "ok", db: "up", version, uptimeSeconds }`; throws 503 `DB_DOWN` if query fails.
- `src/app.ts`: Express application mounting helmet, cors, request-id, access-log, rate-limit, JSON body parser (100kb limit), `/api/v1` router, not-found, error-handler.
- `src/server.ts`: starts HTTP server, listens on `PORT`, handles `SIGTERM` and `SIGINT` with graceful pool shutdown.

### Task 8: Automated Tests
- Unit tests:
  - `money.test.ts`: verify paise conversions, round-tripping, GST addition.
  - `dates.test.ts`: verify `todayIst()`, financial year calculation.
  - `env.test.ts`: verify missing required keys trigger process exit.
  - `error-handler.test.ts`: verify database and generic errors hide internals.
- Integration tests (via Supertest):
  - `GET /api/v1/health`: returns 200 with standard envelope and `X-Request-Id`.
  - `GET /api/v1/unknown`: returns 404 with standard envelope.
  - Malformed JSON POST: returns 400 `VALIDATION_ERROR`.

---

## 3. Verification & Acceptance Criteria

- [x] All unit and integration tests in `backend/` pass via `npm test --workspace=backend`.
- [x] Running `GET /api/v1/health` returns HTTP 200 with standard success envelope.
- [x] Header `X-Request-Id` is present in all HTTP responses and logged in access logs.
- [x] No controller uses `try/catch` or calls `res.json()` directly.
