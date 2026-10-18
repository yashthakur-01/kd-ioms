# KD-IOMS System Requirements Specification

**Primary Requirements Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md)  
**System Version:** 1.0.0-baseline  
**Document Status:** Approved Baseline Specification  

---

## 1. Architectural & Engineering Standards

### 1.1 Response Envelope & API Protocol
All backend endpoints under `/api/v1/*` must return the standardized JSON envelope. Direct calls to `res.json()` in controllers are strictly forbidden; responses must be generated using `utils/response.js`.

- **Success Envelope:**
  ```json
  {
    "success": true,
    "code": "ORDER_PLACED",
    "message": "Order placed",
    "data": { "orderId": 41, "orderNumber": "ORD-000041", "status": "PLACED" },
    "meta": { "requestId": "req_8f3c1a2b", "timestamp": "2026-10-18T09:50:00.000Z" }
  }
  ```
- **List Envelope (includes pagination):**
  ```json
  {
    "success": true,
    "code": "MEDICINES_LISTED",
    "message": "Medicines listed",
    "data": [ { "medicineId": 7, "name": "Dolo 650" } ],
    "meta": {
      "requestId": "req_8f3c1a2b",
      "timestamp": "2026-10-18T09:50:00.000Z",
      "pagination": { "page": 1, "pageSize": 20, "totalItems": 134, "totalPages": 7 }
    }
  }
  ```
- **Error Envelope:**
  ```json
  {
    "success": false,
    "code": "INSUFFICIENT_STOCK",
    "message": "Some items are not available in the requested quantity",
    "errors": [
      { "field": "items[0].quantity", "code": "MAX_EXCEEDED", "message": "Only 4 available", "details": { "available": 4 } }
    ],
    "meta": { "requestId": "req_8f3c1a2b", "timestamp": "2026-10-18T09:50:00.000Z" }
  }
  ```
- **Formatting Rules:**
  - `success` is always a boolean.
  - `code` is an `UPPER_SNAKE` constant exported from `constants/error-codes.js` or `constants/success-codes.js`.
  - `meta.requestId` is generated per request (or extracted from `X-Request-Id`), attached as a response header, logged across all traces, and rendered in error toasts as `Ref: <requestId>`.
  - Monetary values are two-decimal strings (`"100.80"`), never floating-point numbers.
  - Timestamps are UTC ISO-8601 strings (`2026-10-18T09:50:00.000Z`). Expiry/calendar dates are `YYYY-MM-DD`.
  - Internal database errors, table names, and SQL statements must never be returned to the client.

### 1.2 HTTP Status Mapping
- `200 OK`: Successful read or update (`*_LISTED`, `*_FETCHED`, `*_UPDATED`).
- `201 Created`: Resource successfully created (`*_CREATED`, `ORDER_PLACED`).
- `400 Bad Request`: Schema validation failure (`VALIDATION_ERROR`).
- `401 Unauthorized`: Missing, invalid, or expired authentication (`AUTH_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_INVALID_CREDENTIALS`).
- `403 Forbidden`: Authenticated user lacks permission (`FORBIDDEN`, `AUTH_ACCOUNT_INACTIVE`, `AUTH_ACCOUNT_LOCKED`, `AUTH_PASSWORD_CHANGE_REQUIRED`, `RETAILER_NOT_APPROVED`).
- `404 Not Found`: Resource does not exist or belongs to another tenant/retailer (`NOT_FOUND`).
- `409 Conflict`: Business state conflict (`DUPLICATE_RESOURCE`, `INVALID_STATE_TRANSITION`, `INSUFFICIENT_STOCK`, `ORDER_ALREADY_CLAIMED`, `SALT_IN_USE`, `SALT_SIMILAR_EXISTS`, `IDEMPOTENCY_KEY_REUSED`, `PRICE_CHANGED`).
- `422 Unprocessable Entity`: Business rule failure (`PRICE_EXCEEDS_MRP`, `PRICE_EXCEEDS_QUOTE`, `BATCH_EXPIRED`, `BATCH_BLOCKED`, `BATCH_MEDICINE_MISMATCH`, `PICK_EXCEEDS_REQUESTED`, `PICK_EXCEEDS_ON_HAND`, `EXPIRY_IN_PAST`).
- `429 Too Many Requests`: Rate limit threshold exceeded (`RATE_LIMITED`).
- `500 Internal Error`: Unexpected server exception (`INTERNAL_ERROR`).
- `502 Bad Gateway`: External integration failure (`EXTERNAL_SERVICE_ERROR`).

### 1.3 Error Handling & Database Mapping
- Services throw typed exceptions extending `AppError` (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `ExternalServiceError`).
- Controllers never catch errors; all routes wrap handlers in `asyncHandler`.
- `middleware/error-handler.js` handles all rejections.
- `utils/db-error-map.js` maps PostgreSQL errors:
  - `23505` -> `DUPLICATE_RESOURCE` (409)
  - `23503` -> Foreign key conflict / reference error (409)
  - `23514` & trigger exceptions -> Specific 422 business rule codes
  - `40001` (Serialization Failure) & `40P01` (Deadlock Detected) -> Automatically retried up to 2 times, else returned as 409 retry request.

### 1.4 Structured Logging & Tracing
- Logging is handled via `pino` outputting structured NDJSON to stdout.
- Every log line contains: `ts`, `level`, `requestId`, `userId`, `role`, and event metadata.
- Request context is preserved using `AsyncLocalStorage` (`utils/request-context.js`).
- Passwords, refresh tokens, cookie secrets, full phone numbers, and `/auth/*` bodies are strictly redacted (`config/logger.js`).

### 1.5 Validation Standard
- Zod schemas defined per module in `<module>.validation.js`, run via `middleware/validate.js`.
- Schemas are strictly configured with `.strict()` to reject unknown fields.
- Validated output is populated into `req.valid = { body, query, params }`; direct access to `req.body` is banned.
- Enum fields use centralized definitions in `src/enums/`.

### 1.6 Concurrency & Transaction Management
- Transactions are managed strictly via `withTransaction(fn, { retries: 2 })` in `config/db.js`.
- Multi-row operations lock resources in ascending primary key order:
  1. `lockMedicines(tx, ids)`
  2. `lockBatches(tx, ids)`
- All modifications to batch quantity (`batches.quantity_on_hand`) MUST occur through `stock-ledger.service.js#applyLedgerEntry`. Direct updates are prohibited.
- Slow external operations (PDF rendering, WhatsApp/email delivery, Supabase uploads) execute strictly after database commit.

### 1.7 Money and Date Calculations
- Database money stored as `numeric(12,2)`.
- Financial math is calculated in integer paise using `utils/money.js` (`toPaise`, `fromPaise`, `addGst`, `roundHalfUp`). Floating-point arithmetic for currency is strictly prohibited.
- Expiry and operational dates evaluated against Indian Standard Time (`today_ist()` / `todayIst()`).

---

## 2. Functional Requirements by Phase

### Phase 0: System Foundation
- **FR-FND-01:** Server initialization with graceful shutdown on `SIGTERM` / `SIGINT`.
- **FR-FND-02:** Strict environment loading via Zod in `config/env.js`; crash process if mandatory keys missing.
- **FR-FND-03:** Express middleware chain: Request ID -> Pino Request Logger -> Helmet / CORS -> Rate Limiter -> JSON Parser (100kb limit) -> Router -> Error Handler.
- **FR-FND-04:** PostgreSQL pool initialization with SSL, query performance warnings (>500ms), and transaction helper with retry logic.
- **FR-FND-05:** Automated SQL migration runner executing numbered scripts against `schema_migrations`.
- **FR-FND-06:** Baseline database schema migration `001_init.sql` (schema v1.1) establishing custom types, tables, triggers, and views.
- **FR-FND-07:** Health check endpoint `GET /api/v1/health` verifying database connectivity.
- **FR-FND-08:** Next.js frontend scaffolding with Tailwind CSS, TanStack Query, React Hook Form, and API client rewrite (`/api/v1/:path*` -> backend).

### Phase 1: Authentication and User Administration
- **FR-AUT-01:** User authentication via `POST /auth/login` returning 15-minute JWT and setting 7-day HttpOnly secure refresh cookie.
- **FR-AUT-02:** Account lockout after 5 consecutive failed login attempts for 15 minutes (`AUTH_ACCOUNT_LOCKED`). Timing-attack resistant hash verification.
- **FR-AUT-03:** Refresh token rotation via `POST /auth/refresh`. Replay of invalidated token revokes entire session hierarchy.
- **FR-AUT-04:** Graceful logout via `POST /auth/logout` invalidating session and clearing cookie.
- **FR-AUT-05:** Compulsory password change on first login / reset (`must_change_password`), restricting user to `/auth/change-password`, `/auth/logout`, and `/auth/me`.
- **FR-AUT-06:** Password policy enforcement: 10–128 characters, at least one letter, at least one digit.
- **FR-AUT-07:** Current authenticated identity via `GET /auth/me`.
- **FR-AUT-08:** Admin user creation `POST /users` (RETAILER or DELIVERY) generating temporary credentials shown exactly once.
- **FR-AUT-09:** Admin user listing `GET /users` with filters (`role`, `isActive`, search `q`) and pagination.
- **FR-AUT-10:** Admin user status modification `PATCH /users/:userId` preventing self-deactivation and terminating sessions on deactivation.
- **FR-AUT-11:** Admin password reset `POST /users/:userId/reset-password` resetting credentials and forcing password change.

### Phase 2: Retailer Onboarding & Verification
- **FR-RET-01:** Retailer profile retrieval via `GET /retailers/me`.
- **FR-RET-02:** Retailer profile submission / resubmission via `PUT /retailers/me` validating GSTIN (15 chars) and Drug License Number (5–50 chars), transitioning status to `PENDING`.
- **FR-RET-03:** Approved profiles are locked against direct edits.
- **FR-RET-04:** Admin retailer queue `GET /retailers` with filtering by `approvalStatus`.
- **FR-RET-05:** Admin profile approval `POST /retailers/:userId/approve` granting catalog and order placement access.
- **FR-RET-06:** Admin profile rejection `POST /retailers/:userId/reject` requiring 5–300 character rationale, reverting profile to `REJECTED`.
- **FR-RET-07:** Middleware `requireApprovedRetailer` blocking unapproved retailers (`RETAILER_NOT_APPROVED` 403) from protected catalog and ordering routes.

### Phase 3: Salts & Medicines Master
- **FR-SLT-01:** Salt creation `POST /salts` with normalization (whitespace trim/collapse) and trigram similarity check (>0.5 threshold); requires `confirmSimilar: true` to bypass.
- **FR-SLT-02:** Salt search and type-ahead suggestions `GET /salts/suggest` and `GET /salts`.
- **FR-SLT-03:** Salt deactivation `PATCH /salts/:saltId` blocked if linked to any active medicine (`SALT_IN_USE` 409).
- **FR-SLT-04:** Automated trigger maintaining `salts_text` on medicines whenever linked salts are modified.
- **FR-MED-01:** Medicine creation `POST /medicines` with distinct salt associations (0–10 salts), GST rate validation (0–40%), and unique constraint on `(name, company, pack_size)`.
- **FR-MED-02:** Medicine catalog retrieval `GET /medicines` with salt, company, active filters, and sorting.
- **FR-MED-03:** Medicine search endpoint `GET /medicines/search` leveraging PostgreSQL `pg_trgm` similarity index over medicine name and `salts_text`.
- **FR-MED-04:** Medicine modification `PATCH /medicines/:medicineId`. Alteration of GST rate prohibited if any existing batch price incl. GST exceeds its MRP (`PRICE_EXCEEDS_MRP` 422).

### Phase 4: Stock Inward, Batches & Append-Only Ledger
- **FR-STK-01:** Stock inward `POST /stock/inward` accepting medicine, batch number, expiry date, MRP, selling price, purchase rate, quantity, and capture method.
- **FR-STK-02:** Business rule validation: expiry date must be >= today (IST); `sellingPrice * (1 + GST) <= MRP`.
- **FR-STK-03:** Existing batch deduplication: matching `(medicineId, batchNumber, expiryDate, mrp)` increments existing batch quantity without creating duplicate rows (`batchCreated: false`).
- **FR-STK-04:** GS1 / OCR barcode resolution `POST /stock/scan/resolve` extracting GTIN, batch, and expiry.
- **FR-STK-05:** Centralized inventory mutation via `applyLedgerEntry()` recording delta, entry type (`INWARD`, `RESTOCK`, `RETURN_IN`, `OUTWARD`, `EXPIRY_WRITEOFF`, `DAMAGE`, `CORRECTION`), and resulting `balance_after`.
- **FR-STK-06:** Batch management `GET /batches`, `GET /batches/:batchId`, and `PATCH /batches/:batchId` (selling price updates, blocking).
- **FR-STK-07:** Stock adjustment `POST /batches/:batchId/adjust` with required reason (5–300 chars); prevents negative stock balances.
- **FR-STK-08:** Audit ledger inspection `GET /stock/ledger` with batch, medicine, type, and date filters.

### Phase 5: Catalog and Availability Computation
- **FR-CAT-01:** Real-time availability calculation: `sellable_quantity` (ACTIVE batches with `expiry_date >= today_ist()`) minus quantities reserved in `PLACED` orders.
- **FR-CAT-02:** Public/Retailer catalog `GET /catalog` displaying aggregated maximum MRP, maximum price incl. GST, available quantity, and `inStock` boolean. Batch numbers and cost rates remain hidden.
- **FR-CAT-03:** Out-of-stock items displayed with `availableQty: 0` and `inStock: false`.
- **FR-CAT-04:** Admin out-of-stock alert queue `GET /alerts/out-of-stock`.

### Phase 6: Order Placement, Idempotency & Cancellation
- **FR-ORD-01:** Order placement `POST /orders` with header `Idempotency-Key` (UUID). Supports approved retailers and delivery partners ordering on behalf of retailers.
- **FR-ORD-02:** Idempotent replay: identical key and body returns cached 200 response; reused key with differing body returns `409 IDEMPOTENCY_KEY_REUSED`.
- **FR-ORD-03:** Order placement transaction: locks medicine rows ascending (`lockMedicines`), checks availability, validates quote price against catalog max (`PRICE_CHANGED` 409 if stale), generates document number via `next_document_number('ORD')`, creates order and items, logs `order_status_history`.
- **FR-ORD-04:** Concurrency protection: insufficient stock returns `409 INSUFFICIENT_STOCK` detailing available quantities per line without saving order.
- **FR-ORD-05:** Order retrieval `GET /orders` and `GET /orders/:orderId` with strict tenant isolation (retailers cannot view external orders).
- **FR-ORD-06:** Order cancellation `POST /orders/:orderId/cancel` by retailer restricted exclusively to `PLACED` status.

### Phase 7: Order Approval and Batch Picking
- **FR-APR-01:** Order pick suggestions `GET /orders/:orderId/pick-suggestions` delivering available batches in strict FEFO (First Expiring, First Out) order with `withinQuote` indicator.
- **FR-APR-02:** Batch resolution by scanner `POST /batches/resolve-scan` matching GTIN or batch/expiry within medicine.
- **FR-APR-03:** Order approval `POST /orders/:orderId/approve` transaction: locks order and batches ascending (`lockBatches`), validates expiry, verifies picked price incl. GST does not exceed order quote (`PRICE_EXCEEDS_QUOTE` 422), records allocations, applies `OUTWARD` ledger entries, updates line fulfillment status (`FULL`, `PARTIAL`, `NONE`), advances order to `APPROVED`.
- **FR-APR-04:** Dropped shortfalls: unpicked quantities on partial fulfillment are cancelled, not backordered.
- **FR-APR-05:** Order rejection `POST /orders/:orderId/reject`. If rejected from unclaimed `APPROVED` status, all allocated batches are automatically restocked via `RESTOCK` ledger entries.

### Phase 8: Delivery Pooling, Handoff & Refusal
- **FR-DEL-01:** Dispatch pool `GET /delivery/pool` listing unclaimed `APPROVED` orders, ordered oldest first.
- **FR-DEL-02:** Atomic order claim `POST /delivery/orders/:orderId/claim` using single SQL conditional update; prevents race conditions (`ORDER_ALREADY_CLAIMED` 409).
- **FR-DEL-03:** Assigned deliveries inspection `GET /delivery/orders` and `GET /delivery/orders/:orderId`.
- **FR-DEL-04:** Delivery completion `POST /delivery/orders/:orderId/complete` via multipart upload (photo proof required, 5MB limit).
- **FR-DEL-05:** Item refusal handling: line-level decisions (`ACCEPTED` or `REFUSED` with reason). Whole-line refusal triggers automatic `RETURN_IN` ledger entries returning stock to original batches.
- **FR-DEL-06:** Final order status determination: `DELIVERED` if >= 1 line accepted; `REJECTED` if all lines refused. Asynchronous trigger to invoice generation upon commit.

### Phase 9: Invoicing and Multi-Channel Notifications
- **FR-INV-01:** Automated invoice creation upon delivery commit. Generates sequence number formatted `INV/YYYY-YY/00001` for Indian financial year.
- **FR-INV-02:** Calculation rigor: subtotal of accepted items, single aggregate GST total from per-allocation tax, round-off to nearest integer rupee.
- **FR-INV-03:** Branded PDF generation using PDFKit, uploaded to private Supabase Storage bucket.
- **FR-INV-04:** Invoice retrieval `GET /invoices`, `GET /invoices/:invoiceId`, and short-lived signed link `GET /invoices/:invoiceId/pdf` (300-second TTL).
- **FR-NOT-01:** Automated WhatsApp notification via Meta Cloud API with PDF document attachment.
- **FR-NOT-02:** Automated failover to email (Nodemailer) upon WhatsApp delivery failure.
- **FR-NOT-03:** Notification retry worker `jobs/notification-retry.js` executing every 10 minutes for pending/failed logs with exponential backoff (max 3 attempts).
- **FR-NOT-04:** Admin manual trigger `POST /invoices/:invoiceId/resend`.

### Phase 10: Expiry Alerts, Settings & Dashboards
- **FR-EXP-01:** Near-expiry alert list `GET /alerts/near-expiry` filtered by configurable `expiry_alert_days` threshold.
- **FR-EXP-02:** Near-expiry dismissal `POST /alerts/near-expiry/:batchId/dismiss` marking batch as "keep as it is".
- **FR-EXP-03:** Expired inventory list `GET /alerts/expired` showing unsold expired stock.
- **FR-EXP-04:** Physical stock write-off `POST /batches/:batchId/remove-expired` applying `EXPIRY_WRITEOFF` ledger entry and reducing batch to 0.
- **FR-SET-01:** System settings retrieval `GET /settings` and modification `PATCH /settings` (expiry threshold, business profile, GSTIN, drug license). In-memory caching with 60-second TTL.
- **FR-DSH-01:** High-throughput admin dashboard summary `GET /dashboard/summary` executing parallel non-blocking count queries across operational queues.

### Phase 11: Security Hardening, Reliability & Go-Live
- **FR-SEC-01:** OWASP API Security Top 10 compliance checklist verified with zero open vulnerabilities.
- **FR-SEC-02:** Tiered rate limiting: Login (10 per 15 min per IP/username), Mutating APIs (300/min per user), Scan/Search (60/min).
- **FR-SEC-03:** Row-Level Security (RLS) enabled on all tables; Supabase service credentials restricted to backend runtime.
- **FR-REL-01:** Cold-start keep-warm ping and database pool auto-reconnect.
- **FR-REL-02:** Automated daily database backup routine and documented restore rehearsal into clean instance.
- **FR-DAT-01:** Opening master data migration script `scripts/import-medicines.js` with dry-run CSV validation.
- **FR-E2E-01:** Automated Playwright end-to-end integration test executing complete lifecycle: onboarding -> inward -> ordering -> picking -> delivery -> refusal -> invoice delivery.
