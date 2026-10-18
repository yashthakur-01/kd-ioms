# Project Specification — KD-IOMS

**Project:** Kandarp Drugs Inventory and Order Management System (KD-IOMS)  
**Primary Requirements Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md)  
**Status:** Pre-Implementation / Roadmap Alignment  
**Active Development Branches:** `main`, `dev1`, `dev2`, `dev3` (Active branch: `dev1`)  

---

## 1. Project Overview & Domain Scope

KD-IOMS is a specialized B2B pharmacy inventory, catalog, ordering, fulfillment, and delivery management platform built for **Kandarp Drugs**. The system links three core user groups:
1. **Admin (Wholesaler / Warehouse Operations):** Manages user access, reviews retailer onboarding, maintains salt and medicine masters, receives stock via barcode/OCR/manual entry, controls batch ledgers, approves orders with FEFO picking allocations, monitors expiry thresholds, and configures business parameters.
2. **Retailer (Licensed Pharmacies):** Submits KYC and drug license details for admin approval, browses real-time catalog availability, places quote-guaranteed orders with idempotency protections, tracks live order status, and receives digitally generated GST invoices.
3. **Delivery Partner (Couriers / Field Agents):** Claims approved orders from a shared dispatch pool, executes doorstep delivery with photo proof and item acceptance/refusal logging, and coordinates direct order placement on behalf of retailers.

---

## 2. Technology Stack & Architecture

### 2.1 Backend Services
- **Runtime & Language:** Node.js with Express.js written in **TypeScript** (`backend/src/**/*.ts`) for compile-time type safety across controllers, services, queries, and domain models.
- **Database Engine:** PostgreSQL (hosted on Supabase) accessed via `pg` connection pool with direct raw SQL, parameterized queries, and strict transaction isolation.
- **Validation:** Zod schemas applied via centralized middleware (`validate.js`), extracting sanitized payloads into `req.valid` (`body`, `query`, `params`).
- **Authentication & Security:** JWT access token (15-minute TTL, Bearer header) + HttpOnly secure cookie refresh token (7-day TTL, rotated on every refresh, tracked in `auth_sessions`). Role-based authorization middleware with immediate deactivation reflection.
- **Logging & Context:** Pino structured JSON logger with `AsyncLocalStorage` propagating request IDs (`X-Request-Id`) through all database queries and access logs.
- **Document & PDF Generation:** PDFKit producing branded GST tax invoices.
- **External Integrations:**
  - **Storage:** Supabase Private Storage buckets (`photos`, `invoices`) accessed via signed URLs.
  - **WhatsApp API:** Meta Cloud API for automated invoice delivery.
  - **Email:** Nodemailer via SMTP for notification failover.

### 2.2 Frontend Application
- **Runtime & Framework:** Next.js (App Router, React 19) in `frontend/src/`.
- **Styling:** Tailwind CSS with mobile-first responsive layouts, bottom navigation for Retailer and Delivery roles, and minimum 44px touch targets.
- **State & Server Data:** TanStack Query (`@tanstack/react-query`) with query-key factories and zero optimistic updates for stock-mutating flows.
- **Forms & Validation:** React Hook Form integrated with `@hookform/resolvers` and Zod.
- **Scanning & OCR:** HTML5 Camera scanner using browser barcode detectors with ZXing fallback; Tesseract.js / Web Worker OCR for packaging text extraction with manual review fallback.
- **Testing:** Vitest + React Testing Library for components/hooks; Playwright for critical end-to-end flows.

---

## 3. Engineering & Operational Standards

1. **Standard Response Envelope:**
   Every API endpoint returns the uniform envelope:
   - Success: `{ success: true, code, message, data, meta: { requestId, timestamp, pagination? } }`
   - Failure: `{ success: false, code, message, errors: [{ field, code, message, details? }], meta: { requestId, timestamp } }`
2. **Database Integrity & Concurrency:**
   - Single point of truth for inventory: batch stock (`quantity_on_hand`) changes **strictly** through `applyLedgerEntry()` in `stock-ledger.service.js`. Direct SQL updates to batch quantities are prohibited.
   - All multi-row locking operations execute in deterministic ascending order (`lockMedicines(tx, ids)`, `lockBatches(tx, ids)`) to prevent deadlocks.
   - Read-committed transactions retry on serialization failures (`40001`) and deadlock detects (`40P01`).
3. **Financial & Temporal Rigor:**
   - Money values are stored as `numeric(12,2)` in PostgreSQL, manipulated as integer paise via `utils/money.js` (`toPaise`, `fromPaise`, `addGst`, `roundHalfUp`), and formatted as two-decimal strings in JSON. Floats are prohibited for monetary calculations.
   - All server timestamps are UTC ISO-8601 strings. Calendar dates (e.g. batch expiry) follow `YYYY-MM-DD` and evaluate against Indian Standard Time (`today_ist()` in PostgreSQL / `todayIst()` in code).
4. **Error Handling Architecture:**
   - Controllers are wrapped in `asyncHandler` with zero bare `try/catch` blocks.
   - Services throw typed `AppError` subclasses (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `ExternalServiceError`).
   - `error-handler.js` translates database constraint codes (e.g. `23505` to `DUPLICATE_RESOURCE`, `23514` to 422 business rule violations) and strips internal diagnostics for non-operational errors.

---

## 4. Multi-Developer Git Strategy & Team Rules

The engineering team operates across four core branches: `main`, `dev1`, `dev2`, and `dev3`.

1. **Shared Artifacts:**
   - `.planning/*` documents and database migrations are shared team assets.
   - No branch may overwrite another developer's changes without explicit coordination and review.
   - Merges into `main` require all automated phase checks and team approval.
2. **Branch Responsibilities:**
   - `main`: Production-ready, validated code. Direct commits prohibited.
   - `dev1`: Lead Developer / Core Foundation, Authentication, Inventory & Picking (`Phase 0`, `Phase 1`, `Phase 4`, `Phase 7`, shared `Phase 11`).
   - `dev2`: Feature Developer / Medicine Master, Catalog, Orders & Delivery (`Phase 3`, `Phase 5`, `Phase 6`, `Phase 8`, shared `Phase 11`).
   - `dev3`: Feature Developer / Retailer Onboarding, Invoicing, Alerts & Dashboards (`Phase 2`, `Phase 10`, `Phase 9`, shared `Phase 11`).
3. **Commit Convention:**
   - Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `test(scope): ...`, `refactor(scope): ...`.
   - Pull requests must cite the corresponding Requirement ID (e.g., `FR-APR-05`).
4. **Definition of Done (DoD):**
   - Code adheres to layer isolation (`route` -> `validation` -> `controller` -> `service` -> `db`).
   - All input validated with strict Zod schemas (`req.valid`).
   - Standard response envelope and error mapping verified.
   - Multi-table writes wrapped in single atomic transactions.
   - Automated tests (unit and integration) cover all happy and edge paths.
   - SQL migrations are numbered, idempotent, and reversible.
