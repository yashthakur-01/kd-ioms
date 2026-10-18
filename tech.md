## Technical Plan — KD-IOMS Build Phases

Oct 17, 2026 · @Explain Bose-Einstein statistics distribution in detail.

A phase-by-phase plan to build the Kandarp Drugs system: folder structures, functions with inputs, validation and outputs, workflows, and the standards every module follows.

### 1. Overview and Phase Roadmap

The build is twelve phases, each a vertical slice that ends with something a person can use and a test that proves it, so the system is demoable from Phase 1 onward. Phases 2 and 3 can run in parallel after Phase 1; Phase 10 can start once Phase 4 is done.

| Phase | Goal | Main deliverables | Needs | Done when | Size |

| --- | --- | --- | --- | --- | --- |

| 0 | Foundation | Repos, tooling, config, middleware, response and error standards, logger, schema baseline, CI | none | GET /api/v1/health returns the standard envelope; migrations run on an empty database; CI is green | M |

| 1 | Auth and users | Login, refresh, logout, change password; admin creates, lists, deactivates users and resets passwords; role layouts | 0 | Each role logs in and reaches its home; a wrong role gets 403; lockout works | M |

| 2 | Retailer onboarding | Profile submit and resubmit; admin review, approve, reject | 1 | An unapproved retailer is limited to the profile screen; approval opens the catalog | S |

| 3 | Medicines and salts | Salt master with similarity check; medicine create, edit, search | 1 | Duplicates are blocked; salts_text is correct; search by salt works | M |

| 4 | Stock inward and batches | Inward, batches, ledger, write-off, correction, scan screen (barcode, OCR, manual) | 3 | New and existing batches update quantity and ledger together; price above MRP is rejected | L |

| 5 | Catalog and availability | Catalog list and search, availability computation | 4, 2 | Shows maximum final price; "Out of stock" at zero; expired stock excluded | S |

| 6 | Order placement and cancel | Place order (retailer, or delivery partner for a retailer), list, detail, cancel | 5 | Two simultaneous orders cannot oversell (concurrency test) | M |

| 7 | Approval and picking | FEFO hints, batch resolve by scan, approve with allocations, reject with restock | 6 | Allocations, ledger and PARTIAL handling are correct; expired and over-quote picks refused | L |

| 8 | Delivery | Pool, atomic claim, release, deliver with photo, item refusal, admin override | 7 | Only one partner can claim; refusal restocks the original batches | M |

| 9 | Invoice and notifications | Invoice rows, PDF, WhatsApp send, email fallback, resend | 8 | PDF stored and sent; failures logged and retried | L |

| 10 | Expiry, settings, dashboards | Expiry alerts, expired removal, settings, admin dashboard | 4 | Lists match the views; settings change behaviour | S |

| 11 | Hardening and go-live | Full test run, security review, backups, deployment, user acceptance | all | Acceptance checklist signed by the owner | M |

Size is relative effort: S small, M medium, L large.

How each phase section is laid out: goal, backend files, a function table (endpoint, role, inputs with validation, output, errors), the workflow and sequence, frontend work, tests, and the exit check. Sections 2 to 4 hold the standards and folder structures every phase uses, so the phase sections only list what is new.

### 2. Engineering Standards

Every module follows these rules so that any response, error or log line looks the same wherever it comes from. Technology assumptions (Express, pg, Zod) are the proposals in the SRS open list TBD-01.

#### 2.1 Response Envelope

One helper (utils/response.js) builds every success response and one error handler builds every error response. No controller writes res.json directly.

Success

{
  "success": true,
  "code": "ORDER_PLACED",
  "message": "Order placed",
  "data": { "orderId": 41, "orderNumber": "ORD-000041", "status": "PLACED" },
  "meta": { "requestId": "req_8f3c1a2b", "timestamp": "2026-10-17T09:50:00.000Z" }
}

List (adds meta.pagination)

{
  "success": true,
  "code": "MEDICINES_LISTED",
  "message": "Medicines listed",
  "data": [ { "medicineId": 7, "name": "Dolo 650" } ],
  "meta": {
    "requestId": "req_8f3c1a2b",
    "timestamp": "2026-10-17T09:50:00.000Z",
    "pagination": { "page": 1, "pageSize": 20, "totalItems": 134, "totalPages": 7 }
  }
}

Error

{
  "success": false,
  "code": "INSUFFICIENT_STOCK",
  "message": "Some items are not available in the requested quantity",
  "errors": [
    { "field": "items[0].quantity", "code": "MAX_EXCEEDED", "message": "Only 4 available", "details": { "available": 4 } }
  ],
  "meta": { "requestId": "req_8f3c1a2b", "timestamp": "2026-10-17T09:50:00.000Z" }
}

Rules:

success is always present and always a boolean; the front end branches on it first, then on code, never on message text.

code is an UPPER_SNAKE constant from constants/error-codes.js or constants/success-codes.js. message is for humans and may change.

errors[] is present on validation and rule failures. Each entry has field (path such as items[0].quantity), code, message and optional details.

meta.requestId is generated per request (or taken from an incoming X-Request-Id), is returned in the X-Request-Id header, appears in every log line, and is shown to users in error toasts as "Ref: 8f3c1a2b" so a screenshot is enough to find the logs.

Money is a string with two decimals ("100.80"), never a float. Timestamps are ISO 8601 UTC. Calendar dates (expiry) are YYYY-MM-DD. JSON keys are camelCase.

Internal details (SQL, stack traces, table names) never appear in a response; they appear only in logs.

#### 2.2 HTTP Status Mapping

| Status | Used for | Typical code |

| --- | --- | --- |

| 200 | Read or update succeeded | *_LISTED, *_FETCHED, *_UPDATED |

| 201 | Resource created | *_CREATED, ORDER_PLACED |

| 400 | Request shape is invalid | VALIDATION_ERROR |

| 401 | Not logged in or token bad | AUTH_REQUIRED, AUTH_TOKEN_EXPIRED, AUTH_TOKEN_INVALID, AUTH_INVALID_CREDENTIALS |

| 403 | Logged in but not allowed | FORBIDDEN, AUTH_ACCOUNT_INACTIVE, AUTH_ACCOUNT_LOCKED, AUTH_PASSWORD_CHANGE_REQUIRED, RETAILER_NOT_APPROVED |

| 404 | Resource not found, or not visible to this user | NOT_FOUND |

| 409 | Conflicts with current state | DUPLICATE_RESOURCE, INVALID_STATE_TRANSITION, INSUFFICIENT_STOCK, ORDER_ALREADY_CLAIMED, SALT_IN_USE, SALT_SIMILAR_EXISTS |

| 422 | Valid shape, but breaks a business rule | PRICE_EXCEEDS_MRP, PRICE_EXCEEDS_QUOTE, BATCH_EXPIRED, BATCH_BLOCKED, BATCH_MEDICINE_MISMATCH, PICK_EXCEEDS_REQUESTED, PICK_EXCEEDS_ON_HAND, EXPIRY_IN_PAST |

| 429 | Rate limit hit | RATE_LIMITED |

| 500 | Unexpected failure | INTERNAL_ERROR |

| 502 | An external service failed | EXTERNAL_SERVICE_ERROR |

#### 2.3 Error Handling

Services throw typed errors; one middleware turns them into the envelope.

// src/errors/app-error.js
export class AppError extends Error {
  constructor({ code, httpStatus, message, errors = [], cause }) { /* ... */ }
}
// subclasses fix the status: ValidationError(400), AuthError(401), ForbiddenError(403),
// NotFoundError(404), ConflictError(409), BusinessRuleError(422), ExternalServiceError(502)

A service throws, for example, throw new ConflictError({ code: ERROR_CODES.ORDER_ALREADY_CLAIMED, message: 'Order already taken' }).

middleware/error-handler.js is the last middleware. For an AppError it sends the envelope with the error's status. For anything else it logs the full error at error level and sends INTERNAL_ERROR with a generic message.

utils/db-error-map.js maps Postgres errors raised by constraints and triggers: 23505 to DUPLICATE_RESOURCE; 23514 and the trigger messages for price, expiry and quote rules to the matching 422 codes; 23503 to a 409 reference error; 40001 and 40P01 (serialization, deadlock) are retried up to twice and then returned as a 409 asking the user to try again.

Controllers never use try/catch; an asyncHandler wrapper forwards rejections to the error handler.

A 404 is also returned when a retailer asks for another retailer's order, so ids cannot be probed.

#### 2.4 Logging and Debugging

One JSON object per line, written to stdout (Render collects it). Library: pino.

Every line carries ts, level, requestId, userId, role, and the event fields. The request id is held in AsyncLocalStorage (utils/request-context.js), so services log with logger.info({ orderId }, 'order approved') without passing it around.

One access line per request, written when the response finishes:

{"ts":"2026-10-17T09:50:00.412Z","level":"info","msg":"request","requestId":"req_8f3c1a2b","userId":"6c1e...","role":"ADMIN","method":"POST","path":"/api/v1/orders/41/approve","status":201,"durationMs":184,"code":"ORDER_APPROVED"}

Levels: error unexpected failures and failed notifications; warn expected rejections that look suspicious (repeated login failures, rate limits); info access lines and business events (order approved, stock written off); debug off in production.

Never log passwords, tokens, refresh cookies, full phone numbers or request bodies of /auth/*. A redact list in config/logger.js enforces it.

Business events that matter to auditors are also stored in the database (order_status_history, stock_ledger_entries), not only in logs.

#### 2.5 Naming Conventions

| Item | Rule | Example |

| --- | --- | --- |

| Files and folders | kebab-case; module files are <module>.<layer>.js | stock-ledger.service.js |

| Service functions | camelCase, verb first, unique within the module | createUser, listOrders, approveOrder |

| Controller functions | Same name as the service function they call | approveOrder in order.controller.js |

| Routes | Plural kebab-case nouns under /api/v1; state changes are POST /<noun>/:id/<verb> | POST /orders/41/approve |

| Constants | UPPER_SNAKE in constants/ | MAX_PAGE_SIZE |

| Enums | One file per enum in enums/, a frozen object plus a values array | ORDER_STATUS.PLACED |

| Database | snake_case, plural tables, <singular>_id keys | order_items.order_item_id |

| JSON | camelCase; rows are converted by utils/case.js | orderItemId |

| React | Components PascalCase.jsx, hooks useThing.js, everything else kebab-case | OrderCard.jsx, useOrders.js |

| Environment variables | UPPER_SNAKE, validated at start-up | JWT_ACCESS_SECRET |

| Tests | Next to the code in __tests__, <name>.test.js | order.service.test.js |

| Branches and commits | feat/p6-place-order; Conventional Commits | feat(order): reserve stock on placement |

#### 2.6 Validation Standard

Validation is Zod, written once per module in <module>.validation.js and run by middleware/validate.js before the controller. Schemas are .strict(), so unknown fields are rejected. The middleware writes the parsed result to req.valid = { body, query, params }; controllers and services use req.valid, never req.body. Enum fields use z.enum(ORDER_STATUS.values) from the enums folder, so the database, API and front end share one list.

// src/modules/salt/salt.validation.js
import { z } from 'zod';
import { paginationQuery, nonEmptyText } from '../../utils/validators.js';

export const createSaltSchema = {
  body: z.object({
    saltName: nonEmptyText(2, 120),
    confirmNew: z.boolean().default(false), // admin confirmed no similar salt fits
  }).strict(),
};
export const listSaltsSchema = {
  query: paginationQuery.extend({ q: z.string().trim().max(60).optional() }).strict(),
};

Shared fragments live in utils/validators.js: idParam, uuidParam, paginationQuery, nonEmptyText(min, max), moneyString (positive, at most two decimals), quantity (integer 1 to 100000), isoDate, phoneE164, username, password. A failed parse becomes a 400 VALIDATION_ERROR whose errors[] lists every failing field, not only the first.

#### 2.7 Pagination, Search and Sorting

Query parameters: page (default 1), pageSize (default 20, maximum 100), q (search text), sort as field:asc or field:desc. Each list endpoint declares its allowed sort fields; anything else is a 400.

Services return { rows, totalItems }; utils/response.js builds meta.pagination.

Every list query is ordered by a stable key (for example created_at DESC, id DESC) and served by an index.

#### 2.8 Transactions and Concurrency

Only services open transactions, through one helper, and pass the client down explicitly.

// src/config/db.js
export async function withTransaction(fn, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      if (['40001', '40P01'].includes(err.code) && attempt < retries) continue;
      throw mapDbError(err);
    } finally {
      client.release();
    }
  }
}

Multi-row writes lock in a fixed order (medicines by ascending id, then batches by ascending id) to prevent deadlocks. Helpers: lockMedicines(tx, ids), lockBatches(tx, ids).

A function that can run inside a larger transaction takes tx as its first argument and never starts its own.

Anything that changes batches.quantity_on_hand goes through stock-ledger.service.js (applyLedgerEntry), which updates the batch and inserts the ledger row together.

Slow side effects (PDF, WhatsApp, email) run after commit, never inside a transaction.

#### 2.9 Money and Dates

Database money is numeric(12,2); the pg driver returns it as a string, and it stays a string in JSON.

Calculations use integer paise via utils/money.js: toPaise('100.80') returns 10080, fromPaise(10080) returns '100.80', addGst(paise, rate), roundHalfUp(n). Floats are never used for money.

Timestamps are stored and sent in UTC (ISO 8601). Expiry and other calendar dates are YYYY-MM-DD, compared against the India date (today_ist() in the database, utils/dates.js#todayIst() in code). The front end shows times in IST.

#### 2.10 Authentication Conventions

The browser only calls its own origin, /api/v1/*. Next.js rewrites that path to the Render API, so cookies are same-site and no CORS exception is needed.

Access token: a JWT valid 15 minutes, held in memory in the front end and sent as Authorization: Bearer. Claims: sub (user id), role. Refresh token: a random value in an httpOnly, secure cookie scoped to /api/v1/auth; only its hash is stored in auth_sessions, and it is replaced on every use.

middleware/authenticate.js verifies the JWT, then loads the user row (id, role, is_active, must_change_password) with one primary-key query. That is what makes deactivation effective immediately.

A user flagged must_change_password may call only /auth/change-password, /auth/logout and /auth/me; everything else returns AUTH_PASSWORD_CHANGE_REQUIRED.

middleware/authorize.js takes the allowed roles: authorize(ROLES.ADMIN). Retailer ownership checks happen in the service, which filters by retailerId = user.userId.

#### 2.11 Configuration

config/env.js reads the environment once, validates it with Zod, freezes it, and stops the process at start-up if anything is missing. Nothing else reads process.env.

| Variable | Purpose |

| --- | --- |

| NODE_ENV, PORT, LOG_LEVEL | Runtime basics |

| DATABASE_URL | Pooled PostgreSQL connection string |

| JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL | Signing key and lifetime (15m) |

| REFRESH_TOKEN_PEPPER, REFRESH_TOKEN_TTL_DAYS | Hashing pepper for refresh tokens, lifetime (7) |

| SUPABASE_URL, SUPABASE_SERVICE_KEY | Storage access only |

| STORAGE_BUCKET_PHOTOS, STORAGE_BUCKET_INVOICES | Private bucket names |

| WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_INVOICE_TEMPLATE | Meta Cloud API |

| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM | Nodemailer |

| FRONTEND_ORIGIN | Allowed origin for the API |

#### 2.12 Testing Standards

Unit tests for pure logic: money, availability maths, invoice totals, validators, state-transition rules.

Integration tests call the real routes with supertest against a throw-away PostgreSQL loaded from schema.sql; each test file starts from a clean database. No mocking of the database.

Flow tests run the full story: onboard, inward, order, approve, deliver, invoice, refuse.

External services (WhatsApp, SMTP, storage) are replaced by in-memory fakes in src/test/fakes.

Targets: every endpoint has at least one success and one failure test; every business rule in the SRS maps to a test named after its id, for example FR-APR-05.

#### 2.13 Git, Review and Definition of Done

Short-lived feature branches off main; one phase is several small pull requests. CI runs lint (ESLint), format (Prettier), tests and a migration dry run on every pull request.

A change is done when: it uses the response envelope; input is validated in *.validation.js; enums and error codes come from the shared folders; multi-table writes are in one transaction; there are tests for success and failure; the SRS requirement id is in the pull request description; and the migration, if any, is numbered and reversible in staging.

### 3. Backend Structure and Module Template

The back end is one Node.js application split into feature modules. Every module has the same four files, and a request always travels route, validation, controller, service.

#### 3.1 Folder Structure

backend/
  package.json  .env.example  .eslintrc.cjs  .prettierrc  render.yaml
  scripts/
    migrate.js            run numbered SQL migrations in order
    seed.js               first admin + default settings (never demo data in production)
  src/
    server.js             start HTTP server, graceful shutdown on SIGTERM
    app.js                Express wiring: helmet, json limit, request-id, access log, routes, 404, error handler
    routes.js             mounts every module router under /api/v1
    config/
      env.js              validated, frozen environment
      db.js               pg Pool, query(), withTransaction(), lockMedicines(), lockBatches()
      logger.js           pino instance + redact list
      jwt.js              signAccessToken(), verifyAccessToken()
      storage.js          Supabase Storage client (photos, invoice PDFs)
      whatsapp.js         Meta Cloud API client: sendTemplateWithDocument()
      mail.js             Nodemailer transport: sendMail()
    enums/
      user-role.enum.js  approval-status.enum.js  order-status.enum.js
      fulfilment-status.enum.js  delivery-item-status.enum.js  batch-status.enum.js
      ledger-entry-type.enum.js  capture-method.enum.js
      notification-channel.enum.js  notification-status.enum.js  index.js
    constants/
      error-codes.js  success-codes.js  limits.js  regex.js
      document-series.js  settings-keys.js
    errors/
      app-error.js  index.js
    middleware/
      request-id.js  access-log.js  authenticate.js  authorize.js  validate.js
      rate-limit.js  async-handler.js  upload.js  not-found.js  error-handler.js
    utils/
      response.js  case.js  money.js  dates.js  validators.js  pagination.js
      request-context.js  db-error-map.js  crypto.js
    modules/
      auth/          auth.validation.js  auth.route.js  auth.controller.js  auth.service.js
      user/          user.validation.js  user.route.js  user.controller.js  user.service.js
      retailer/      retailer.*  (profile + review)
      salt/          salt.*
      medicine/      medicine.*
      batch/         batch.*  (batches + expiry alerts + write-off)
      stock-ledger/  stock-ledger.*  (inward + every quantity change)
      catalog/       catalog.*  (catalog + out-of-stock alerts)
      order/         order.*  (place, list, detail, cancel, approve, reject)
      allocation/    allocation.*  (picking rules, batch resolve by scan)
      delivery/      delivery.*  (pool, claim, release, deliver, override)
      invoice/       invoice.*  + invoice.template.js (PDF layout)
      notification/  notification.*  (send, retry, resend, log)
      settings/      settings.*
    db/
      migrations/    001_baseline.sql (schema v1.1)  002_idempotency_keys.sql  ...
      seeds/         seed-admin.js  seed-settings.js  seed-demo.js (non-production)
    test/
      helpers/       db.js  auth.js  factories.js
      fakes/         whatsapp.fake.js  mail.fake.js  storage.fake.js
      flows/         order-lifecycle.test.js  refusal.test.js  concurrency.test.js

Each module may also have a __tests__/ folder. A module that grows past about 400 lines may add one <module>.helpers.js for pure functions; it is reviewed like any other file. The SRS lists 14 modules; the two alert lists are served by batch (near-expiry, expired) and catalog (out of stock) under the /alerts path.

#### 3.2 What Each Layer May Do

| Layer | Does | Must not |

| --- | --- | --- |

| *.validation.js | Declares Zod schemas for body, query, params of every route | Query the database or hold business rules |

| *.route.js | Lists routes in order: authenticate, authorize, validate, asyncHandler(controller.fn) | Contain logic |

| *.controller.js | Reads req.valid and req.user, calls one service function, returns the response helper | Open transactions, run SQL, or catch errors |

| *.service.js | Business rules, SQL, transactions, calls to other services | Touch req, res or HTTP status codes |

| Another module | Calls this module's service functions | Query this module's tables directly |

#### 3.3 Module Template

The salt module shows the pattern; every other module copies it.

// salt.route.js
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import * as controller from './salt.controller.js';
import * as schema from './salt.validation.js';

const router = Router();
router.use(authenticate, authorize(USER_ROLE.ADMIN));
router.get('/', validate(schema.listSaltsSchema), asyncHandler(controller.listSalts));
router.get('/similar', validate(schema.similarSaltsSchema), asyncHandler(controller.findSimilarSalts));
router.post('/', validate(schema.createSaltSchema), asyncHandler(controller.createSalt));
router.patch('/:saltId', validate(schema.updateSaltSchema), asyncHandler(controller.updateSalt));
export default router;

// salt.controller.js
import * as saltService from './salt.service.js';
import { created, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function createSalt(req, res) {
  const salt = await saltService.createSalt(req.valid.body, req.user);
  return created(res, { code: SUCCESS_CODES.SALT_CREATED, message: 'Salt created', data: salt });
}

export async function listSalts(req, res) {
  const { rows, totalItems } = await saltService.listSalts(req.valid.query);
  return okList(res, { code: SUCCESS_CODES.SALTS_LISTED, message: 'Salts listed',
    data: rows, page: req.valid.query.page, pageSize: req.valid.query.pageSize, totalItems });
}

// salt.service.js
import { query } from '../../config/db.js';
import { ConflictError } from '../../errors/index.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { toCamel } from '../../utils/case.js';

export async function createSalt({ saltName, confirmNew }, actor) {
  const name = saltName.trim().replace(/\s+/g, ' ');
  if (!confirmNew) {
    const similar = await findSimilarSalts({ name });
    if (similar.length) {
      throw new ConflictError({
        code: ERROR_CODES.SALT_SIMILAR_EXISTS,
        message: 'Similar salts already exist',
        errors: [{ field: 'saltName', code: 'SIMILAR_EXISTS', message: 'Pick an existing salt or confirm', details: { similar } }],
      });
    }
  }
  // an exact duplicate hits the unique index; db-error-map turns it into DUPLICATE_RESOURCE
  const { rows } = await query(
    'INSERT INTO salts (salt_name, created_by) VALUES ($1, $2) RETURNING *', [name, actor.userId]);
  return toCamel(rows[0]);
}

#### 3.4 Shared Files and Their Functions

| File | Exports | Behaviour |

| --- | --- | --- |

| utils/response.js | ok(res, {code, message, data, meta}), created(...), okList(res, {..., page, pageSize, totalItems}) | Adds success, meta.requestId, meta.timestamp; builds meta.pagination |

| middleware/validate.js | validate({ body, query, params }) | Parses with Zod, writes req.valid, else throws ValidationError with errors[] |

| middleware/authenticate.js | authenticate(req, res, next) | Verifies the JWT, loads the user, rejects inactive users, sets req.user = { userId, role, mustChangePassword } |

| middleware/authorize.js | authorize(...roles) | Throws ForbiddenError if req.user.role is not listed |

| middleware/rate-limit.js | loginLimiter, writeLimiter | Per-IP limits; throws RATE_LIMITED |

| middleware/upload.js | uploadPhoto | Accepts one JPEG or PNG up to 5 MB into memory; rejects other types |

| utils/db-error-map.js | mapDbError(err) | Converts Postgres error codes and trigger messages into AppError |

| utils/money.js | toPaise, fromPaise, addGst, roundHalfUp | Integer money maths |

| utils/dates.js | todayIst(), addDays(date, n), financialYearOf(date) | India-date helpers; financial year for invoice series |

| utils/pagination.js | parsePagination(query), buildOrderBy(sort, allowed) | Safe LIMIT/OFFSET and whitelisted sorting |

| utils/crypto.js | hashPassword, verifyPassword, newRefreshToken, hashRefreshToken | bcrypt or Argon2id; random 256-bit refresh tokens, stored hashed |

| utils/case.js | toCamel(row), toCamelList(rows) | snake_case rows to camelCase objects |

| utils/request-context.js | runWithContext, getRequestId, getActor | AsyncLocalStorage for logs |

| config/db.js | query(text, params), withTransaction(fn), lockMedicines(tx, ids), lockBatches(tx, ids) | Single pool; ordered FOR UPDATE locks |

### 4. Frontend Structure and Conventions

The front end is one Next.js project (App Router, JavaScript with JSDoc types) serving three role areas. Server data is handled by TanStack Query, forms by React Hook Form with Zod, and styling by Tailwind CSS. There is no global store beyond the auth context.

#### 4.1 Folder Structure

frontend/
  package.json  next.config.js  .env.example  .eslintrc.json  tailwind.config.js
  public/                 icons, manifest.webmanifest
  scripts/sync-enums.js   copies backend src/enums into src/lib/enums (CI fails on drift)
  src/
    middleware.js         redirect to /login when the refresh cookie is missing (UX only, not security)
    app/
      layout.jsx          root layout: providers, fonts
      page.jsx            redirect to the role home
      not-found.jsx  error.jsx  global-error.jsx
      (auth)/
        login/page.jsx  change-password/page.jsx
      (admin)/
        layout.jsx        admin shell + role guard
        dashboard/page.jsx
        users/page.jsx  users/new/page.jsx
        retailers/page.jsx  retailers/[userId]/page.jsx
        salts/page.jsx
        medicines/page.jsx  medicines/new/page.jsx  medicines/[medicineId]/page.jsx
        stock/inward/page.jsx      scan or type, confirm, save
        batches/page.jsx  batches/[batchId]/page.jsx
        orders/page.jsx  orders/[orderId]/page.jsx     detail and picking
        alerts/page.jsx           near-expiry, expired, out of stock
        settings/page.jsx
      (retailer)/
        layout.jsx        mobile shell with bottom navigation + role guard
        profile/page.jsx  catalog/page.jsx  cart/page.jsx
        orders/page.jsx  orders/[orderId]/page.jsx    includes invoice link
      (delivery)/
        layout.jsx
        pool/page.jsx  deliveries/page.jsx  deliveries/[orderId]/page.jsx
        place-order/page.jsx
    components/
      ui/            Button  Input  Select  Modal  Table  Badge  Toast  Spinner  EmptyState
                     Pagination  ConfirmDialog  FormField
      layout/        AppShell  Sidebar  BottomNav  PageHeader
      feedback/      ErrorBanner (message + Ref id)  FieldError
      scan/          CameraScanner  OcrCapture  ScanConfirmForm  ManualEntryToggle
      domain/        OrderStatusBadge  PriceTag  QuantityStepper  MedicineSearch
                     BatchPicker  ExpiryBadge  OrderTimeline
    features/        one folder per backend module, each with:
      <feature>/api.js        functions that call the API (one per endpoint)
      <feature>/keys.js       query-key factory
      <feature>/hooks.js      useXxx query and mutation hooks
      <feature>/schema.js     Zod schemas for the forms
      <feature>/components/   components used only by this feature
      auth  users  retailers  salts  medicines  stock  batches  catalog
      orders  picking  delivery  invoices  alerts  settings
    lib/
      api/           client.js  endpoints.js  api-error.js  error-messages.js
      auth/          token-store.js  session.js  guards.js
      scan/          barcode.js  ocr.js  parse-pack-text.js
      format/        money.js  date.js  number.js
      enums/         generated copy of the backend enums
      constants/     routes.js  roles.js
    hooks/           useDebounce  useConfirm  usePagination  useQueryParams
    providers/       AuthProvider  QueryProvider  ToastProvider
    styles/          globals.css  tokens.css

#### 4.2 API Client and Response Handling

One function, lib/api/client.js#apiFetch, makes every call. It prefixes /api/v1, sends the access token, adds an Idempotency-Key when asked, parses the envelope, and throws ApiError for any success: false.

// src/lib/api/client.js  (shape, not complete)
export async function apiFetch(path, { method = 'GET', query, body, signal, idempotencyKey } = {}) {
  let res = await send(path, { method, query, body, signal, idempotencyKey });
  if (res.status === 401 && (await errorCode(res)) === 'AUTH_TOKEN_EXPIRED') {
    await refreshOnce();                       // concurrent calls share one refresh
    res = await send(path, { method, query, body, signal, idempotencyKey });
  }
  const json = await res.json();
  if (!json.success) throw new ApiError({ status: res.status, ...json });
  return json;                                 // callers use json.data and json.meta
}

// src/lib/api/api-error.js
export class ApiError extends Error {
  constructor({ status, code, message, errors = [], meta }) { /* keeps requestId = meta.requestId */ }
}

| Envelope result | What the UI does |

| --- | --- |

| success: true | Shows message in a toast for writes; reads data; lists also read meta.pagination |

| VALIDATION_ERROR | applyFieldErrors(err, setError) puts each errors[].message under its field; field paths match React Hook Form names (items.0.quantity) |

| AUTH_TOKEN_EXPIRED | Silent refresh once, then the call is repeated; if the refresh fails, log out and go to /login |

| AUTH_PASSWORD_CHANGE_REQUIRED | Redirect to /change-password |

| FORBIDDEN, RETAILER_NOT_APPROVED | Show the "not allowed" or "profile pending" screen |

| INSUFFICIENT_STOCK | Mark each short line using details.available |

| ORDER_ALREADY_CLAIMED | Toast "Already taken" and refresh the pool |

| 422 rule codes | Show the code's friendly text from error-messages.js, falling back to message |

| INTERNAL_ERROR, 502 | Generic text plus "Ref: <requestId>" for support |

#### 4.3 Frontend Conventions

One call path: components never call fetch. They use a hook from features/<x>/hooks.js, which uses api.js, which uses apiFetch.

Query keys come from a factory per feature, for example ordersKeys.list(filters) and ordersKeys.detail(id). A mutation invalidates the keys it affects. Stock-changing actions are never optimistic.

Forms: React Hook Form with zodResolver. The submit button is disabled while the request is pending. Placing an order generates one idempotency key per submit attempt.

Enums and codes come from lib/enums and lib/api/error-messages.js, never as string literals in components.

Money and dates: lib/format/money.js shows ₹1,234.50 in the en-IN style from the API's string; date.js shows IST. No arithmetic on money in the browser except display of line totals through the same paise helpers.

Role areas: each area's layout.jsx checks user.role and redirects; this is for navigation only, because the API enforces access.

Mobile first: retailer and delivery areas use a bottom navigation bar; tables turn into card lists below 640 px; touch targets are at least 44 px.

Scanning: CameraScanner asks for camera permission, uses the browser's barcode detector with the ZXing fallback, runs OCR in a web worker, and releases the camera when the screen closes. Every result goes to ScanConfirmForm, where fields are editable; ManualEntryToggle is always visible.

Errors: route segments have error.jsx; the toast and ErrorBanner always show the request id for 5xx and unknown errors.

Accessibility: every input has a label, errors are linked with aria-describedby, focus moves to the first error on submit.

Testing: Vitest and React Testing Library for components and hooks; Playwright for the main flows (login, place order, approve, deliver).

### 5. Phase 0: Foundation

Goal: an empty but deployable system where every later module plugs into the same shell, with the envelope, errors, logging, database access and CI already working.

#### 5.1 Backend Files

| File | Purpose |

| --- | --- |

| src/server.js | Reads config, connects the pool, starts listening, handles SIGTERM (drain, then close the pool) |

| src/app.js | Builds the Express app: request-id, logger, helmet, rate limit, JSON parser (100 kb), routes, 404, error handler |

| src/config/env.js | Parses process.env with Zod; exits with a readable list of missing or invalid variables |

| src/config/index.js | Exports the typed config object (port, db, jwt, cookie, cors, rateLimit, meta, smtp) |

| src/db/pool.js | One pg.Pool (max 10, SSL on) and query(text, params) |

| src/db/transaction.js | withTransaction(fn) with retry on 40001 and 40P01 |

| src/db/migrate.js | Runs migrations/*.sql in order and records them in schema_migrations |

| src/errors/* | AppError and subclasses, mapDbError |

| src/middleware/request-id.js, request-logger.js, rate-limit.js, validate.js, error-handler.js, not-found.js | As in section 2 |

| src/utils/async-handler.js, response.js, money.js, dates.js, validators.js, pagination.js | Shared helpers |

| src/enums/*.js | All enums (roles, order status, ledger types, and so on), each exported as a frozen object plus a values array |

| src/routes/index.js | Mounts each module router under /api/v1; at this stage only /health |

| migrations/001_init.sql | The tested schema.sql v1.1 |

#### 5.2 Functions

| Function | Input | Validation | Output / behaviour |

| --- | --- | --- | --- |

| loadEnv() | process.env | Zod: required DATABASE_URL, JWT_ACCESS_SECRET (32+ chars), COOKIE_SECRET, APP_ORIGIN; defaults for the rest | Frozen config object; on failure prints every problem and exits with code 1 |

| query(text, params) | SQL string, array | Parameters only (no string building) | { rows, rowCount }; slow queries over 500 ms are logged as warnings |

| withTransaction(fn, opts?) | fn(client), { retries = 2 } | None | Result of fn; rolls back on any throw; retries only on 40001 and 40P01 |

| ok(res, data, { message, meta, status }) | Response, payload | None | Sends the success envelope with requestId and timestamp |

| fail(res, err) | AppError | None | Sends the error envelope with the right HTTP status |

| validate({ body, query, params }) | Zod schemas | Each schema is strict; unknown keys are rejected | Sets req.valid; on failure throws ValidationError with errors[] |

| errorHandler | Any thrown value | None | Known AppError is returned as is; a DB error goes through mapDbError; anything else is logged with stack and returned as INTERNAL_ERROR without internals |

| todayIst() | none | None | YYYY-MM-DD for the current India date |

| toPaise(str) and fromPaise(int) | "100.80" or 10080 | Regex ^\d+(\.\d{1,2})?$ | Integer paise, or the two-decimal string |

#### 5.3 Endpoint

| Method and path | Auth | Output |

| --- | --- | --- |

| GET /api/v1/health | Public | data: { status: "ok", db: "up", version, uptimeSeconds }; 503 with code: "DB_DOWN" if select 1 fails |

#### 5.4 Request Flow

Client -> request-id -> request-logger -> helmet/cors -> rate-limit -> json parser
       -> router -> [authenticate -> authorize] -> validate -> controller -> service -> db
       <- ok()/fail()  <- error-handler (any throw)  <- response with X-Request-Id

#### 5.5 Frontend and Operations Work

Create the Next.js project with Tailwind, TanStack Query, React Hook Form, Zod; add providers/, lib/api/client.js, ApiError, the toast, and the empty role layouts.

next.config.js rewrite: /api/v1/:path* goes to BACKEND_URL.

Repositories, environment files, Vercel and Render projects, Supabase project; run migrate.js against Supabase.

GitHub Actions: lint, unit tests, sync-enums drift check, and a build on every pull request.

Keep-warm ping on Render's free tier (see SRS TBD-05).

#### 5.6 Tests and Exit Check

Unit: loadEnv rejects a missing secret; toPaise and fromPaise round-trip; withTransaction retries once on 40001 and rolls back on a throw; the error handler hides internals.

Integration: /health returns the envelope with a request id header; an unknown route returns a NOT_FOUND envelope; malformed JSON returns VALIDATION_ERROR.

Done when: both apps deploy from main, the migration is applied, the health call works through the Vercel origin, and a deliberate failing route shows the request id in the browser toast and in the server log line.

### 6. Phase 1: Authentication and Users

Goal: the admin can sign in, create retailer and delivery accounts, and every protected route knows who is calling.

#### 6.1 Backend Files

| Module | Files |

| --- | --- |

| auth | auth.validation.js, auth.route.js, auth.controller.js, auth.service.js |

| user | user.validation.js, user.route.js, user.controller.js, user.service.js |

| middleware | authenticate.js, authorize.js, require-password-changed.js |

| utils | password.js (hash, verify, generate temporary password), tokens.js (sign and verify access token, generate and hash refresh token) |

| scripts | seed-admin.js creates the first admin from ADMIN_USERNAME and ADMIN_PASSWORD |

#### 6.2 Endpoints

| Method and path | Role | Body / query | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| POST /auth/login | Public | { username, password } | username trimmed, lower-cased, 3–50 chars, [a-z0-9._-]; password 1–128 chars | 200 data: { accessToken, expiresIn: 900, user: { id, username, role, mustChangePassword } }; sets refresh cookie | AUTH_INVALID_CREDENTIALS 401, AUTH_ACCOUNT_LOCKED 403 with details.lockedUntil, AUTH_ACCOUNT_INACTIVE 403 |

| POST /auth/refresh | Cookie | none | Cookie present and well-formed | 200 new accessToken and a rotated cookie | AUTH_REFRESH_INVALID 401; a reused old token revokes that session family |

| POST /auth/logout | Cookie | none | none | 200 data: null; session revoked, cookie cleared | none (always succeeds) |

| POST /auth/change-password | Any signed in | { currentPassword, newPassword } | new password 10–128 chars, at least one letter and one digit, different from the current one | 200; mustChangePassword cleared; all other sessions revoked | AUTH_INVALID_CREDENTIALS 401, VALIDATION_ERROR |

| GET /auth/me | Any signed in | none | none | 200 data: { id, username, role, phone, mustChangePassword } | 401 |

| POST /users | Admin | { username, role, phone, temporaryPassword? } | role in RETAILER or DELIVERY (the admin is only seeded); phone ^[6-9]\d{9}$; temporary password optional (generated if empty) | 201 data: { user, temporaryPassword } (shown once) | DUPLICATE_RESOURCE 409 |

| GET /users | Admin | ?role&isActive&q&page&pageSize&sort | role in enum; q max 100; pageSize 1–100, default 20 | 200 list plus meta.pagination | none |

| GET /users/:userId | Admin | param uuid | uuid | 200 user without hash | NOT_FOUND |

| PATCH /users/:userId | Admin | { phone?, isActive? } (at least one) | strict; cannot deactivate self | 200 updated user; deactivation revokes all sessions | FORBIDDEN if self |

| POST /users/:userId/reset-password | Admin | none | uuid | 200 data: { temporaryPassword }; sets must_change_password, clears lockout, revokes sessions | NOT_FOUND |

#### 6.3 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| authService.login({ username, password, ip, userAgent }) | validated values | Load user by username; if locked, stop; verify hash (always run a hash check, even when the user is missing, so timing is equal); on failure increment failed_login_count and lock for 15 minutes at 5; on success reset counters, create a session row with the hashed refresh token, sign the access token | { accessToken, refreshToken, user } |

| authService.refresh({ refreshToken }) | cookie value | Hash and look up; reject if revoked, expired or user inactive; revoke it and issue a new one in one transaction; reuse of a revoked token revokes the user's sessions | { accessToken, refreshToken } |

| authService.changePassword({ userId, currentPassword, newPassword }) | validated | Verify current, hash new, set password_changed_at, clear must_change_password, revoke other sessions | void |

| userService.create({ actorId, username, role, phone, temporaryPassword }) | validated | Insert with must_change_password = true, created_by = actorId; password shown once | { user, temporaryPassword } |

| authenticate | Authorization: Bearer | Verify JWT, load the user row, reject inactive; set req.user = { id, role, mustChangePassword } | continues or AUTH_TOKEN_INVALID / AUTH_TOKEN_EXPIRED |

| authorize(...roles) | role list | Compare req.user.role | continues or FORBIDDEN |

| requirePasswordChanged | none | Blocks everything except /auth/* while mustChangePassword | continues or AUTH_PASSWORD_CHANGE_REQUIRED |

#### 6.4 Sequence: Sign-in and Silent Refresh

Browser            Next.js (rewrite)        API                       Database
  | POST /auth/login ---------------------> | validate body            |
  |                                          | select user by username  |--->
  |                                          | verify hash, reset count |--->
  |                                          | insert auth_sessions     |--->
  | <-- 200 accessToken + Set-Cookie refresh |                          |
  | ... 15 minutes later, a call returns 401 AUTH_TOKEN_EXPIRED         |
  | POST /auth/refresh (cookie) ----------> | hash, lookup, rotate     |--->
  | <-- 200 new accessToken + new cookie     |                          |
  | repeat the original call ---------------> ...

#### 6.5 Frontend Work

AuthProvider keeps the user and the access token in memory; on first load it calls /auth/refresh and then /auth/me.

Screens: login, change-password, admin users list, users/new (shows the temporary password once with a copy button and a warning), and a reset-password confirm dialog.

Role layouts redirect by user.role; a user with mustChangePassword is sent to /change-password.

#### 6.6 Tests and Exit Check

Unit: password policy, token sign and verify, lockout counter.

Integration: five wrong passwords lock the account and the sixth, correct one is still refused; refresh rotation works and replaying the old token fails; a deactivated user's access token is refused on the next call; a retailer calling POST /users gets 403.

Done when: the admin signs in, creates a retailer, the retailer signs in with the temporary password, is forced to change it, and then lands on the retailer area.

### 7. Phase 2: Retailer Onboarding

Goal: a retailer fills in the shop profile, the admin reviews it, and only approved retailers can reach the catalog and ordering.

#### 7.1 Backend Files

retailer/ with retailer.validation.js, retailer.route.js, retailer.controller.js, retailer.service.js; middleware/require-approved-retailer.js; enums approval-status.js.

#### 7.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /retailers/me | Retailer | none | none | 200 profile or data: null if not yet submitted, plus approvalStatus | none |

| PUT /retailers/me | Retailer | { shopName, addressLine, city, state, pincode, whatsappNumber, email?, drugLicenseNumber, gstin? } | shopName 2–120; addressLine 5–250; pincode ^\d{6}$; whatsappNumber E.164 ^\+[1-9]\d{7,14}$; email valid or empty; GSTIN 15-character pattern, upper-cased; drug licence 5–50 chars, trimmed | 200 profile with approvalStatus: PENDING; editing a REJECTED profile resubmits it as PENDING; editing an APPROVED profile is refused | DUPLICATE_RESOURCE (licence or GSTIN), INVALID_STATE_TRANSITION |

| GET /retailers | Admin | ?approvalStatus&q&page&pageSize&sort | enum; q max 100 | 200 list and meta.pagination | none |

| GET /retailers/:userId | Admin | uuid | uuid | 200 profile with the user's phone and username | NOT_FOUND |

| POST /retailers/:userId/approve | Admin | none | uuid | 200 profile APPROVED, reviewedBy, reviewedAt | INVALID_STATE_TRANSITION if not PENDING |

| POST /retailers/:userId/reject | Admin | { reason } | reason 5–300 chars | 200 profile REJECTED with the reason | INVALID_STATE_TRANSITION |

#### 7.3 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| retailerService.upsertMine(userId, dto) | validated DTO | Lock the row; if status is APPROVED throw; insert or update; set status PENDING and clear the rejection reason | profile |

| retailerService.review(adminId, userId, decision, reason?) | uuid, APPROVE or REJECT | Lock the row, check it is PENDING, set reviewer fields, write the result | profile |

| requireApprovedRetailer | req.user | Reads approval_status for the caller; passes only for APPROVED retailers | continues or RETAILER_NOT_APPROVED 403 |

#### 7.4 Workflow

Admin creates account (phase 1) -> Retailer signs in -> forced password change
  -> Retailer submits profile (PENDING)
  -> Admin opens the pending list -> Approve  -> APPROVED: catalog and orders unlocked
                                  -> Reject   -> REJECTED with reason -> retailer edits and resubmits

#### 7.5 Frontend Work

Retailer: profile form with field-level errors; a status banner (pending, approved, rejected with the reason); catalog and cart links are disabled until approved.

Admin: retailers list with status tabs, retailers/[userId] detail with Approve and Reject (reason dialog).

#### 7.6 Tests and Exit Check

Integration: submit, approve, then place a call to a protected retailer route; a PENDING retailer gets RETAILER_NOT_APPROVED; duplicate licence number returns 409 on the field drugLicenseNumber; rejecting without a reason returns 400.

Done when: a new retailer goes from PENDING to APPROVED through the UI and the gated pages unlock without a reload of the app.

### 8. Phase 3: Salts and Medicines Master

Goal: the admin maintains one clean list of salts and a medicine master that points to those salts by id, so names never drift by casing or typos.

#### 8.1 Backend Files

salt/ and medicine/ modules (four files each). The salt module is the worked example in section 3. Shared: utils/normalize.js (normalizeName: trim, collapse inner spaces) and enums/gst-slab.js (allowed GST rates: 0, 5, 12, 18, 28, shown as hints; the database accepts 0–40).

#### 8.2 Salt Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /salts | Admin | ?q&isActive&page&pageSize | q max 100; pageSize 1–100 | 200 list { saltId, saltName, isActive, medicineCount } | none |

| GET /salts/suggest | Admin | ?q | 2–80 chars | 200 up to 10 { saltId, saltName, similarity } for type-ahead | none |

| POST /salts | Admin | { saltName, confirmSimilar? } | 2–80 chars, trimmed, inner spaces collapsed, letters digits space - ( ) , . | 201 salt | DUPLICATE_RESOURCE 409 (same name ignoring case); SALT_SIMILAR_EXISTS 409 with details.matches, repeated with confirmSimilar: true to force |

| PATCH /salts/:saltId | Admin | { saltName?, isActive? } | as above | 200 salt; a rename updates every medicine's salts_text through the trigger | DUPLICATE_RESOURCE, SALT_IN_USE 409 when deactivating a salt that active medicines use |

#### 8.3 Medicine Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| POST /medicines | Admin | { name, company, packSize?, gstRate, saltIds[] } | name 2–150; company 2–100; packSize max 50; gstRate number 0–40, two decimals; saltIds 0–10 distinct positive integers | 201 medicine with salts: [{saltId, saltName}] | DUPLICATE_RESOURCE (same name, company and pack size), VALIDATION_ERROR for an unknown or inactive salt id (saltIds.2) |

| GET /medicines | Admin | ?q&saltId&company&isActive&page&pageSize&sort | sort in name, company, createdAt with - prefix for descending | 200 list and meta.pagination | none |

| GET /medicines/search | Admin, Delivery | ?q | 2–100 chars | 200 up to 15 matches by name or salt text (trigram) for pickers | none |

| GET /medicines/:medicineId | Admin | int | positive integer | 200 medicine, salts, onHand, active batch count | NOT_FOUND |

| PATCH /medicines/:medicineId | Admin | any of the create fields plus isActive | strict; at least one field | 200; changing gstRate is allowed only if no existing batch of this medicine would then have price incl. GST above MRP | PRICE_EXCEEDS_MRP 422, DUPLICATE_RESOURCE |

#### 8.4 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| saltService.create({ saltName, confirmSimilar }, actorId) | normalized name | Check exact match; unless confirmed, run the trigram query (similarity above 0.5); insert | salt |

| saltService.deactivate(saltId) | id | Count active medicines using the id (salt_ids @> ARRAY[id]); refuse if any | salt |

| medicineService.create(dto, actorId) | DTO | Normalize text; insert; map unique violation to DUPLICATE_RESOURCE, FK-style trigger error to VALIDATION_ERROR on saltIds | medicine |

| medicineService.search(q) | text | lower(name) % q or lower(salts_text) % q ordered by similarity, limit 15 | array |

| mapMedicine(row, saltsById) | DB row | Converts to camelCase, joins salt names, formats gstRate as a string | response object |

#### 8.5 Frontend Work

Admin salts page: table, add dialog with a type-ahead that shows near matches ("Did you mean Paracetamol?") and a confirm step.

Admin medicines list, create and edit form with a multi-select salt chip input that only allows picking existing salts, and an "add new salt" shortcut.

MedicineSearch component used later by stock inward, order placement and picking.

#### 8.6 Tests and Exit Check

Integration: "Paracetamol" and " paracetamol " collide; "Paracetamol 500" returns the similar-salt prompt; a medicine with an inactive salt id fails with the field path saltIds.1; renaming a salt changes saltsText in the medicine list; the unique identity rule holds across casing.

Done when: the admin can build a medicine list with multi-salt medicines and search it by name or salt.

### 9. Phase 4: Stock Inward, Batches and Ledger

Goal: the admin receives stock by scanning or typing, each receipt creates or tops up a batch, and every quantity change is recorded in the append-only ledger.

#### 9.1 Backend Files

batch/ and stock-ledger/ modules. stock-ledger.service.js is the only code allowed to change quantity_on_hand; other modules call applyLedgerEntry. Shared: enums/ledger-entry-type.js, enums/batch-status.js, enums/capture-method.js; utils/gtin.js (parseGs1(payload) returns { gtin, batchNumber, expiryDate } when the QR or barcode is GS1 formatted).

#### 9.2 Core Function

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| applyLedgerEntry(client, { batchId, type, delta, reason?, supplierName?, orderId?, orderItemId?, userId }) | Open transaction client, validated values | Lock the batch row; check the new balance is not negative; update quantity_on_hand; insert the ledger row with balance_after; the ledger type decides the allowed sign (INWARD, RESTOCK, RETURN_IN positive; OUTWARD, EXPIRY_WRITEOFF, DAMAGE negative; CORRECTION either) | { entryId, balanceAfter }; throws INSUFFICIENT_STOCK if the balance would go below zero |

#### 9.3 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| POST /stock/inward | Admin | { medicineId, batchNumber, expiryDate, mrp, sellingPrice, purchaseRate, quantity, supplierName?, gtin?, qrPayload?, captureMethod } | medicineId positive int; batchNumber 1–50 trimmed; expiryDate YYYY-MM-DD and on or after today (India); mrp, sellingPrice greater than 0 with at most two decimals, sellingPrice × (1 + GST) not above MRP; purchaseRate 0 or more; quantity integer 1–100000; GTIN 8–14 digits; captureMethod in enum | 201 data: { batch, ledgerEntry }. If the same medicine, batch number, expiry and MRP already exist, the quantity is added to that batch and the response says batchCreated: false | NOT_FOUND (medicine), EXPIRY_IN_PAST 422, PRICE_EXCEEDS_MRP 422, BATCH_MEDICINE_MISMATCH 422 if the GTIN already belongs to another medicine |

| POST /stock/scan/resolve | Admin | { payload } | 1–2000 chars | 200 data: { gtin?, batchNumber?, expiryDate?, medicineSuggestions[] } to prefill the confirmation form | none |

| GET /batches | Admin | ?medicineId&status&expiry=ALL,NEAR,EXPIRED&inStock&q&page&pageSize&sort | enums; sort expiryDate, -expiryDate, createdAt | 200 list { batchId, medicine, batchNumber, expiryDate, daysLeft, mrp, sellingPrice, priceInclGst, quantityOnHand, status } | none |

| GET /batches/:batchId | Admin | int | positive integer | 200 batch plus the last 20 ledger entries | NOT_FOUND |

| PATCH /batches/:batchId | Admin | { sellingPrice?, status? } | price rule as above; status ACTIVE or BLOCKED | 200; a price change does not alter existing orders because they keep their own quote | PRICE_EXCEEDS_MRP |

| POST /batches/:batchId/adjust | Admin | { type, quantity, reason } | type in DAMAGE, CORRECTION, EXPIRY_WRITEOFF; quantity non-zero integer; reason 5–300 chars | 200 { batch, ledgerEntry } | INSUFFICIENT_STOCK, INVALID_STATE_TRANSITION if EXPIRY_WRITEOFF is used on a batch that has not expired |

| GET /stock/ledger | Admin | ?batchId&medicineId&type&from&to&page&pageSize | dates YYYY-MM-DD, from not after to | 200 entries with delta, balanceAfter, actor and reference order | none |

#### 9.4 Sequence: Stock Inward

Admin phone         Frontend                    API (stock service)             Database
  | open camera ---> CameraScanner
  | scan/photo ----> parse GS1 / OCR text -> POST /stock/scan/resolve -> parseGs1, medicine lookup
  | <- prefilled ScanConfirmForm (every field editable, medicine picker, manual toggle)
  | confirm ------> POST /stock/inward ---> validate -> BEGIN
  |                                         lock medicine, find or insert batch  --->
  |                                         applyLedgerEntry(INWARD)              --->
  |                                         COMMIT
  | <---------------- 201 batch + ledger entry (requestId in meta)

#### 9.5 Frontend Work

stock/inward page: choose scan, photo (OCR) or manual; always land on the confirmation form with date and number inputs; price fields show the computed price including GST and block saving above MRP.

batches list with filters (near-expiry, expired, in stock) and a detail page with the ledger; adjust dialog with required reason.

lib/scan/parse-pack-text.js extracts batch, expiry (MM/YY, MM/YYYY, DD/MM/YYYY) and MRP candidates from OCR text; it only suggests, never saves.

#### 9.6 Tests and Exit Check

Unit: GS1 parsing, OCR text parsing with noisy samples, ledger sign rules.

Integration: two parallel inward calls for the same batch both land and the balance equals the sum; an expired date is refused; price above MRP is refused; every adjustment writes one ledger row with the right balanceAfter; an attempt to update the ledger directly fails at the database.

Done when: the admin can receive stock from a phone by scanning or by hand and the ledger always reconciles with quantity_on_hand.

### 10. Phase 5: Catalog and Availability

Goal: an approved retailer sees each medicine once, with the highest MRP, the highest final price including GST, and how much is available; out-of-stock items show as out of stock.

#### 10.1 Backend Files

catalog/ module (four files). It reads the views v_catalog and v_medicine_availability. Availability is sellable batch quantity (ACTIVE and not expired) minus the quantity of orders still in PLACED, computed on every read.

#### 10.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /catalog | Approved retailer, Delivery, Admin | ?q&saltId&inStock&page&pageSize&sort | q max 100; inStock boolean; sort name, -name, price, -price; pageSize 1–50 default 20 | 200 list { medicineId, name, company, packSize, salts[], gstRate, maxMrp, maxPriceInclGst, availableQty, inStock } plus pagination | RETAILER_NOT_APPROVED |

| GET /catalog/:medicineId | Same | int | positive integer | 200 one item (same shape); no batch details are exposed to retailers | NOT_FOUND |

| GET /alerts/out-of-stock | Admin | ?page&pageSize | pagination | 200 active medicines whose available quantity is zero | none |

#### 10.3 Rules Implemented

maxMrp is the highest MRP and maxPriceInclGst the highest selling price × (1 + GST) among sellable batches with stock. With no sellable stock both are null and inStock is false.

availableQty is never negative; zero shows as out of stock; no hidden threshold.

The retailer never sees batch numbers, purchase rates or expiry dates.

#### 10.4 Frontend Work

Retailer catalog: search box with debounce, in-stock toggle, card list on phones, quantity stepper with a visible maximum, and an "Add to cart" button disabled when out of stock. The cart is kept in local storage per user and cleared after a successful order.

PriceTag shows the price including GST with the MRP struck through beside it.

Admin alerts gets the out-of-stock tab.

#### 10.5 Tests and Exit Check

Integration: two batches at different prices show the higher final price; an expired batch's stock is excluded from availableQty; a PLACED order lowers availability and a cancelled one restores it; a PENDING retailer is refused.

Done when: the catalog matches the database for a mixed set of fresh, near-expiry and expired batches.

### 11. Phase 6: Order Placement and Cancellation

Goal: a retailer (or a delivery partner on the retailer's behalf) places an order against live availability at the catalog price, and can cancel while it is still PLACED.

#### 11.1 Backend Files

order/ module (four files, plus order.helpers.js for the state machine table). Migration 002_idempotency_keys.sql adds idempotency_keys(key, user_id, request_hash, response, created_at, primary key (key, user_id)). Shared: middleware/idempotency.js, enums/order-status.js.

#### 11.2 State Machine (order.helpers.js)

| From | To | Who | Condition |

| --- | --- | --- | --- |

| PLACED | CANCELLED | Retailer (own order) | Only while PLACED |

| PLACED | APPROVED | Admin | Phase 7 |

| PLACED, APPROVED (unclaimed) | REJECTED | Admin | Phase 7 |

| APPROVED | OUT_FOR_DELIVERY | Delivery partner | Claim, Phase 8 |

| OUT_FOR_DELIVERY | DELIVERED or REJECTED | Delivery partner | Phase 8 |

assertTransition(from, to) throws INVALID_STATE_TRANSITION for anything else. Each change inserts a row into order_status_history.

#### 11.3 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| POST /orders | Approved retailer; Delivery (with retailerId) | Header Idempotency-Key (uuid). Body { retailerId?, note?, items: [{ medicineId, quantity, quotedPriceInclGst }] } | items 1–60, no duplicate medicineId; quantity integer 1–5000; quotedPriceInclGst two-decimal string; note max 300; retailerId required only for delivery and must be an APPROVED retailer; retailers may not send it | 201 data: { orderId, orderNumber, status: "PLACED", items[], createdAt }; same key and body again returns the stored response with 200 | VALIDATION_ERROR, INSUFFICIENT_STOCK with details: [{ medicineId, requested, available }], PRICE_EXCEEDS_QUOTE-type check: 409 PRICE_CHANGED if the quote is below the current catalog maximum, NOT_FOUND, idempotency key reused with a different body gives 409 IDEMPOTENCY_KEY_REUSED |

| GET /orders | Retailer (own), Admin (all), Delivery (pool, own) | ?status&from&to&retailerId&q&page&pageSize&sort | enums; dates; sort createdAt, -createdAt | 200 list { orderId, orderNumber, retailer, status, itemCount, createdAt } | none |

| GET /orders/:orderId | Owner, Admin, assigned Delivery | int | positive integer | 200 full order with items, allocations (admin and delivery only), history and invoice link | NOT_FOUND (also for another retailer's order) |

| POST /orders/:orderId/cancel | Retailer (own) | { reason? } | reason max 300 | 200 order CANCELLED | INVALID_STATE_TRANSITION 409 when no longer PLACED |

#### 11.4 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| orderService.place({ actor, retailerId, items, note }) | validated | In one transaction: lockMedicines(ids) ascending; recompute availability for each medicine; compare with the requested quantity; compare each quote with the current maximum price incl. GST and reject if lower; get the number from next_document_number('ORD'); insert order, items and the first history row | order DTO |

| orderService.cancel({ actor, orderId, reason }) | ids | Lock the order, check ownership and PLACED, set status and cancelled_at, write history | order DTO |

| idempotency(requestScope) | header, user, body hash | Looks up the key; replays the saved response for the same hash; stores the response after success | continues or replays |

#### 11.5 Sequence: Place Order

Retailer app           API                                      Database
  | POST /orders (Idempotency-Key) -> authenticate, requireApprovedRetailer, validate
  |                                   idempotency lookup          --->
  |                                   BEGIN; lock medicines (asc) --->
  |                                   availability per medicine   --->
  |                                   next_document_number('ORD') --->
  |                                   insert order, items, history --->  COMMIT
  | <- 201 order PLACED (stored under the key for replay)
  | stock short -> 409 INSUFFICIENT_STOCK with per-line available quantities; nothing saved

#### 11.6 Frontend Work

cart page: edit quantities, show line totals and the order total from the displayed quotes, one "Place order" button that is disabled while pending, and one idempotency key created per attempt and reused on retry.

On INSUFFICIENT_STOCK the lines that are short are highlighted with the available quantity and a one-tap "Use available" action.

orders list and detail with a status timeline (OrderTimeline) and a Cancel button visible only while PLACED.

Delivery area place-order page: choose a retailer, then the same cart flow.

#### 11.7 Tests and Exit Check

Integration: two retailers racing for the last units, so exactly one succeeds; a double-click with the same key creates one order; a stale lower quote returns PRICE_CHANGED; cancelling a claimed order is refused; another retailer cannot read the order.

Done when: orders can be placed, replayed safely, and cancelled, with availability reacting at once.

### 12. Phase 7: Approval and Batch Picking

Goal: the admin reviews a PLACED order, picks real batches for each line by scanning or choosing, and approves it; partial fulfilment is allowed and the shortfall is dropped.

#### 12.1 Backend Files

allocation/ module (four files) for picking, plus approval and reject functions in order.service.js. Uses stock-ledger.service.js for OUTWARD and RESTOCK entries. Shared: enums/fulfilment-status.js.

#### 12.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /orders/:orderId/pick-suggestions | Admin | param | order must be PLACED | 200 per line: sellable batches in FEFO order { batchId, batchNumber, expiryDate, mrp, priceInclGst, onHand, withinQuote } | INVALID_STATE_TRANSITION |

| POST /orders/:orderId/approve | Admin | { picks: [{ orderItemId, allocations: [{ batchId, quantity, captureMethod, scannedPayload? }] }] } | picks cover each line once (a line may have an empty allocations array meaning none); quantity integer 1–5000; sum per line not above requested quantity; captureMethod in enum; scannedPayload max 2000 | 200 data: { order, items: [{ orderItemId, requested, picked, fulfilmentStatus }] }; status APPROVED | PICK_EXCEEDS_REQUESTED 422, PICK_EXCEEDS_ON_HAND 422, BATCH_EXPIRED 422, BATCH_BLOCKED 422, BATCH_MEDICINE_MISMATCH 422, PRICE_EXCEEDS_QUOTE 422 with the batch's price and the quote, INVALID_STATE_TRANSITION, VALIDATION_ERROR if every line is empty (use reject instead) |

| POST /orders/:orderId/reject | Admin | { reason } | reason 5–300 chars | 200 order REJECTED; if it was APPROVED and unclaimed, the picked stock is returned with RESTOCK entries | INVALID_STATE_TRANSITION when the order is claimed or later |

| POST /batches/resolve-scan | Admin | { payload, medicineId? } | 1–2000 chars | 200 the matching batch (by GTIN, batch number and expiry) or 404 BATCH_NOT_FOUND, used by the picking screen to turn a scan into a batch | BATCH_NOT_FOUND |

#### 12.3 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| orderService.approve({ adminId, orderId, picks }) | validated | One transaction: lock the order and require PLACED; collect all batch ids, lock them ascending; per allocation check the batch matches the line's medicine, is ACTIVE and not expired (India date), has enough on hand, and that its price incl. GST does not exceed the line's quote; insert allocations with price, MRP and GST snapshots; call applyLedgerEntry(OUTWARD) per allocation; set picked_quantity and fulfilment_status (FULL, PARTIAL, NONE); set order APPROVED; write history | order DTO |

| orderService.reject({ adminId, orderId, reason }) | validated | Lock the order; from PLACED just change status; from unclaimed APPROVED write RESTOCK entries for every allocation and then change status; record reason and history | order DTO |

| allocationService.suggest(orderId) | id | For each line, return sellable batches ordered by earliest expiry with withinQuote flags | array |

| allocationService.resolveScan(payload, medicineId?) | text | parseGs1, then match by GTIN or by batch number and expiry within the medicine | batch or error |

The database trigger allocations_check_rules repeats the expiry, medicine and price-cap checks as a safety net; service errors come first with friendly codes.

#### 12.4 Sequence: Approve With Picking

Admin screen            API                                         Database
  | open order -> GET /orders/:id + /pick-suggestions
  | per line: scan pack -> POST /batches/resolve-scan -> batch (or choose from the list)
  |   enter quantity from this batch; repeat for another batch if needed
  | Approve -> POST /orders/:id/approve -> BEGIN; lock order (PLACED) ->
  |                                         lock batches (asc) ->
  |                                         validate each pick -> insert allocations ->
  |                                         ledger OUTWARD per allocation -> update items ->
  |                                         order APPROVED + history -> COMMIT
  | <- 200 order with fulfilment per line (FULL / PARTIAL / NONE)
  | any rule fails -> full rollback, error names the line and batch

#### 12.5 Frontend Work

Admin orders queue (PLACED first) and orders/[orderId] picking screen: one card per line showing requested quantity, a running picked total, the FEFO suggestions, "Scan batch" (camera with manual fallback), and rows for each chosen batch with an editable quantity.

Lines with nothing picked are marked "Not supplied"; a summary shows the order as complete or partial before the Approve button.

A Reject action with a reason dialog.

#### 12.6 Tests and Exit Check

Integration: picking from an expired batch fails; a pick above the quote fails; two admins approving the same order, so one succeeds and one gets INVALID_STATE_TRANSITION; a partial pick leaves the line PARTIAL and the rest dropped; rejecting an approved, unclaimed order restores every batch to its earlier quantity; ledger rows match allocations.

Done when: an order moves from PLACED to APPROVED through the UI with batch-level stock reduced and traceable.

### 13. Phase 8: Delivery, Refusal and Proof

Goal: delivery partners claim approved orders first come, first served, deliver with a photo, or refuse whole items on the spot, and stock and order status follow.

#### 13.1 Backend Files

delivery/ module (four files). Photo upload uses Supabase Storage through utils/storage.js (uploadDeliveryPhoto(buffer, mime, orderId) returns the object path). Add multer memory storage with a 5 MB limit and JPEG, PNG or WebP only.

#### 13.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /delivery/pool | Delivery | ?page&pageSize | pagination | 200 APPROVED orders with no partner, oldest first: { orderId, orderNumber, retailer: { shopName, city, pincode }, itemCount, approvedAt } | none |

| POST /delivery/orders/:orderId/claim | Delivery | param | int | 200 order OUT_FOR_DELIVERY with address, phone and items to hand over | ORDER_ALREADY_CLAIMED 409, INVALID_STATE_TRANSITION |

| GET /delivery/orders | Delivery | ?status&page&pageSize | enum | 200 the partner's own orders | none |

| GET /delivery/orders/:orderId | Delivery (assigned) | int | int | 200 order, retailer contact, address, items with picked quantities and batch numbers | NOT_FOUND |

| POST /delivery/orders/:orderId/complete | Delivery (assigned) | multipart/form-data: photo file, decisions JSON [{ orderItemId, decision: "ACCEPTED" or "REFUSED", reason? }] | photo required; every line with picked quantity above zero must appear once; reason 3–200 chars required when REFUSED | 200 order DELIVERED (at least one accepted) or REJECTED (all refused); includes the final item statuses and, if delivered, invoice: { invoiceId, invoiceNumber } | VALIDATION_ERROR, INVALID_STATE_TRANSITION, FORBIDDEN (not the assigned partner), EXTERNAL_SERVICE_ERROR 502 if the upload fails (nothing changed) |

#### 13.3 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| deliveryService.claim({ partnerId, orderId }) | ids | One atomic statement: update orders set status='OUT_FOR_DELIVERY', delivery_partner_id=$1, claimed_at=now() where order_id=$2 and status='APPROVED' and delivery_partner_id is null returning *; no row means someone else won, or the status is wrong | order DTO |

| deliveryService.complete({ partnerId, orderId, photo, decisions }) | validated | Upload the photo first; then in one transaction lock the order and check it is OUT_FOR_DELIVERY for this partner; for each REFUSED line write RETURN_IN ledger entries back to the original batches (one per allocation) and mark the line; mark the others ACCEPTED; set DELIVERED if any accepted, else REJECTED with the combined reason; write history; commit; then call invoiceService.generate for a DELIVERED order | order DTO |

The return is per whole line only: either the full picked quantity of an item is kept or all of it is refused. There is no partial refusal and no later return.

#### 13.4 Sequence: Complete a Delivery

Partner phone              API                                   Storage / Database
  | claim -> POST /delivery/orders/:id/claim -> atomic update (first caller wins)
  | deliver, take photo, mark each line accepted or refused
  | POST /delivery/orders/:id/complete (photo + decisions)
  |                         validate -> upload photo to storage -->
  |                         BEGIN; lock order; for refused lines RETURN_IN per allocation -->
  |                         status DELIVERED or REJECTED; history; COMMIT -->
  |                         if DELIVERED: invoice generation (phase 9), after commit
  | <- 200 final order state

#### 13.5 Frontend Work

Delivery pool (pull to refresh, claim button with a clear "Already taken" message), deliveries list, and deliveries/[orderId] with the address, a tap-to-call link, an item checklist with Accept and Refuse (reason required), a camera capture for the photo with a preview, and a final summary before submitting.

Large touch targets, works on a slow connection, shows upload progress, and the Submit button is locked while the request runs.

#### 13.6 Tests and Exit Check

Integration: ten concurrent claims, exactly one wins; refusing an item restores the original batch quantities; all items refused gives REJECTED and no invoice; accepting one and refusing another gives DELIVERED with the right accepted set; a different partner cannot complete the order; a failed upload leaves the order unchanged.

Done when: a full lifecycle from claim to delivered works from a phone and the ledger shows the correct OUTWARD and RETURN_IN entries.

### 14. Phase 9: Invoice and Notifications

Goal: a delivered order produces a numbered invoice PDF with a single GST figure, sent to the retailer on WhatsApp with an email fallback, with every attempt logged.

#### 14.1 Backend Files

invoice/ and notification/ modules (four files each). Provider code lives in notification/providers/ (whatsapp.provider.js for the Meta Cloud API, email.provider.js for Nodemailer) and is allowed to be called only from notification.service.js. PDF building is in invoice/invoice.pdf.js (pdfkit). Retry job: jobs/notification-retry.js.

#### 14.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /invoices | Admin; Retailer (own) | ?from&to&retailerId&page&pageSize | dates; retailer cannot pass retailerId | 200 list { invoiceId, invoiceNumber, orderNumber, total, generatedAt } | none |

| GET /invoices/:invoiceId | Admin, owner | int | positive integer | 200 invoice with lines, subtotal, GST amount, round-off, total and notification status | NOT_FOUND |

| GET /invoices/:invoiceId/pdf | Admin, owner | int | positive integer | 200 data: { url, expiresIn: 300 }, a short-lived signed storage link | NOT_FOUND |

| POST /invoices/:invoiceId/resend | Admin | { channel? } | WHATSAPP or EMAIL, optional | 202 queued; response lists the new notification_log rows | EXTERNAL_SERVICE_ERROR when the retry itself fails fast |

#### 14.3 Key Functions

| Function | Input | Behaviour | Output |

| --- | --- | --- | --- |

| invoiceService.generate(orderId) | id of a DELIVERED order | Run after the delivery commit. In one transaction: ensure no invoice exists (order id is unique, so a repeat returns the existing one); take the number from next_document_number('INV') formatted INV/2026-27/00001 for the financial year; read ACCEPTED lines and their allocations; subtotal is the sum of price × quantity; the GST amount is the sum of the per-allocation GST; round-off to the nearest rupee; insert the invoice with the retailer snapshot in billed_to. Then build the PDF, upload it, save pdf_path. | invoice |

| invoicePdf.build(invoice, lines, business) | data | PDF with business profile and GSTIN, retailer details, one table of lines (medicine, batch, expiry, quantity, MRP, rate, amount), subtotal, a single GST line, round-off, total, order number and date | Buffer |

| notificationService.sendInvoice(invoiceId) | id | Create a PENDING log row for WhatsApp, send the template message with the PDF link; on success mark SENT with the provider message id; on failure record the error, create an EMAIL row and send through Nodemailer if the retailer has an email; each outcome is saved separately | array of log rows |

| notificationRetryJob.run() | none | Every 10 minutes picks log rows that are not SENT with fewer than 3 attempts and retries them with backoff | count retried |

A failure in PDF building or sending never changes the delivery result; the invoice can be regenerated or resent by the admin.

#### 14.4 Sequence: Invoice After Delivery

deliveryService.complete (committed, DELIVERED)
   -> invoiceService.generate(orderId)
        number from document_sequences -> insert invoice -> build PDF -> upload to Storage
   -> notificationService.sendInvoice(invoiceId)
        WhatsApp via Meta API ---- ok ------> log SENT
                               \-- failed --> log FAILED -> email via Nodemailer -> log SENT or FAILED
   -> retry job picks any open rows later

#### 14.5 Frontend Work

Retailer: invoice link in the order detail and a small invoices list; the PDF opens from the signed link.

Admin: invoice view with the notification history and a Resend button; failed deliveries appear as a badge on the order.

#### 14.6 Tests and Exit Check

Unit: the invoice number format across the 31 March to 1 April change; the GST sum and round-off; PDF text contains one GST line only.

Integration: delivering twice cannot make two invoices; a WhatsApp failure creates an email attempt; the retry job stops after three attempts; a retailer cannot fetch another retailer's PDF.

Done when: completing a delivery produces an invoice and a log row within seconds, and the admin can resend it.

### 15. Phase 10: Expiry Alerts, Settings and Dashboard

Goal: the admin sees batches nearing expiry (global threshold), sees expired stock, removes or keeps it, edits settings, and gets a daily overview.

#### 15.1 Backend Files

settings/ module (four files); alert endpoints are added to batch.route.js under /alerts and use the views v_expiry_alerts and v_expired_stock; dashboard queries live in settings-independent batch.service.js and order.service.js helper functions (no new module). settings.service.js caches settings in memory for 60 seconds and clears the cache on update.

#### 15.2 Endpoints

| Method and path | Role | Input | Validation | Success output | Errors |

| --- | --- | --- | --- | --- | --- |

| GET /alerts/near-expiry | Admin | ?page&pageSize | pagination | 200 batches with stock within expiry_alert_days of expiry and not dismissed: { batchId, medicine, batchNumber, expiryDate, daysLeft, quantityOnHand } | none |

| GET /alerts/expired | Admin | ?page&pageSize | pagination | 200 expired batches with stock: daysExpired, quantity | none |

| POST /alerts/near-expiry/:batchId/dismiss | Admin | none | int | 200 the batch with expiryAlertDismissedAt ("keep as it is") | NOT_FOUND, INVALID_STATE_TRANSITION if already expired |

| POST /batches/:batchId/remove-expired | Admin | { reason? } | reason max 300 | 200 ledger EXPIRY_WRITEOFF for the full quantity, batch quantity zero | INVALID_STATE_TRANSITION if not yet expired |

| GET /settings | Admin | none | none | 200 { expiryAlertDays, businessProfile } | none |

| PATCH /settings | Admin | { expiryAlertDays?, businessProfile? } | expiryAlertDays integer 1–730; businessProfile { name, address, gstin, drugLicenseNumber, phone, email, logoPath? } with GSTIN and phone patterns | 200 new settings | VALIDATION_ERROR |

| GET /dashboard/summary | Admin | none | none | 200 { pendingRetailers, placedOrders, approvedUnclaimed, outForDelivery, nearExpiryBatches, expiredBatches, outOfStockMedicines, failedNotifications } | none |

#### 15.3 Key Functions

| Function | Behaviour |

| --- | --- |

| batchService.listNearExpiry(days) | Reads the view with the setting value; excludes dismissed batches and batches already expired |

| batchService.removeExpired(batchId, adminId, reason) | Locks the batch, checks expiry_date < today_ist() and quantity above zero, calls applyLedgerEntry(EXPIRY_WRITEOFF) with the full quantity |

| settingsService.get() and update(patch, adminId) | Merges the patch into app_settings rows, stores updated_by, clears the cache |

| dashboardService.summary() | Eight small count queries run in parallel through one pooled connection each, so a slow count cannot block the rest |

Expired batches are excluded from sale automatically, because availability only counts batches that are ACTIVE and not expired. Removal is only the admin's bookkeeping when stock leaves the shelf.

#### 15.4 Workflow

Near expiry (days left <= threshold):  alert -> Admin: reduce stock (adjust DAMAGE/CORRECTION) or Keep (dismiss)
Expired (date passed):                 never sold -> listed under Expired -> Admin physically removes -> Remove (EXPIRY_WRITEOFF)
Out of stock (available = 0):          shown as Out of stock in the catalog and on the admin alerts page

#### 15.5 Frontend Work

Admin dashboard with count tiles linking to the filtered lists; alerts page with three tabs (near expiry, expired, out of stock) and row actions; settings form with the threshold and the business profile used on invoices.

Alert badge counts in the admin navigation, refreshed every 60 seconds.

#### 15.6 Tests and Exit Check

Integration: changing the threshold changes the alert list at once; a dismissed batch leaves the near-expiry list but still shows in the expired list after its date; removing a batch before expiry is refused; the dashboard counts equal the list totals.

Done when: the admin can run a day's expiry routine without touching the database.

### 16. Phase 11: Hardening and Go-Live

Goal: the system is safe, observable, backed up and rehearsed before the first real retailer logs in.

#### 16.1 Work Items

| Area | Task | Done when |

| --- | --- | --- |

| Security | Run through the OWASP API Top 10 list; confirm every route has authenticate and authorize; check that no endpoint returns another user's data; helmet, strict CORS (same origin only), cookie flags httpOnly, secure, sameSite=strict, path /api/v1/auth | Checklist signed off with evidence per item |

| Rate limits | Login 10 per 15 minutes per IP and username; general 300 per minute per user; scan and search endpoints 60 per minute | Limit headers visible and tests pass |

| Data | Row-level security stays enabled with no public policies; Supabase service credentials only in Render's environment; Storage bucket private with signed links | Direct anon access to every table fails |

| Backups | Daily database backup (Supabase on a paid tier, otherwise a scheduled pg_dump to storage) and a restore rehearsal into an empty database | Restore completed and verified once |

| Performance | Run explain on the catalog, orders list and pick suggestion queries with seeded data (50k medicines, 200k batches); add indexes only where proven | Catalog under 300 ms and approval under 500 ms at the p95 |

| Observability | Log shipping to a free log service; an uptime ping on /health; alert on repeated 5xx; the request id from a toast finds the full log line | A deliberate error is traced from the toast to the log in under a minute |

| Reliability | Graceful shutdown; pool error handling; Render cold-start handling (keep-warm ping, UI loading state that waits up to 30 seconds) | First request after idle succeeds |

| Data entry | Import script scripts/import-medicines.js for the opening medicine and salt lists from CSV with a dry-run mode; opening stock entered through inward | Imported counts match the CSV |

| Testing | Full end-to-end scenario in Playwright: create retailer, approve, add stock, order, approve with picking, claim, deliver with a refusal, invoice sent | Passes on a clean database in CI |

| Documentation | OpenAPI file generated from the Zod schemas; a short admin guide and a delivery partner guide; runbook for restart, restore and rotating secrets | Reviewed by the owner |

| Release | Production environment variables; admin seeded; first retailer created with a temporary password; one supervised week | Go-live checklist signed |

#### 16.2 Release Checklist

Migrations applied in order and recorded; schema matches 001_init.sql plus 002_idempotency_keys.sql.

ADMIN_PASSWORD changed after the first login; seed variables removed.

Meta WhatsApp template approved and tested with a real number; Nodemailer credentials tested.

Business profile (name, GSTIN, address, licence) filled in under Settings.

Expiry threshold set; opening stock and medicine master loaded.

Backup restore rehearsal done; uptime monitor active.

#### 16.3 Known Risks Carried Forward

Free-tier hosting can sleep or throttle; move to a paid tier if retailer count grows (SRS TBD-05).

Browser OCR accuracy varies with print quality; the confirmation screen and manual entry are the safety net.

Meta WhatsApp business messaging has its own approval and per-message cost rules; the email fallback covers outages.

### 17. End-to-End Sequence

order lifecycle · 4 actors, 5 calls

Every call goes through the same chain (authenticate, authorize, validate, controller, service, database) and returns the standard envelope. Calls 2 and 4 are single transactions that change stock together with order status. The invoice in call 5 is produced after the delivery transaction commits, so a PDF or message failure never undoes a delivery.