# Plan 9-05: Invoices HTTP Endpoints & Admin Resend

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-05`  
**Wave:** 5 (API Surface & Authorization)  
**Dependencies:** Plan 9-03, Plan 9-04  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Implement the complete HTTP API surface for Invoices (`GET /api/v1/invoices`, `GET /api/v1/invoices/:invoiceId`, `GET /api/v1/invoices/:invoiceId/pdf`, `POST /api/v1/invoices/:invoiceId/resend`), request validation schemas, authentication/authorization checks (tenant isolation), and register routes into the main Express application.

---

## 2. Tasks & Detailed Instructions

### Task 1: Validation Schemas (`backend/src/modules/invoice/invoice.validation.ts`)
- Query schema for `GET /invoices`:
  - `from`: optional ISO date string (`YYYY-MM-DD`).
  - `to`: optional ISO date string (`YYYY-MM-DD`).
  - `retailerId`: optional UUID string (allowed ONLY for Admin role).
  - `page`: optional integer >= 1 (default 1).
  - `pageSize`: optional integer 1–100 (default 20).
- Params schema for `:invoiceId`:
  - `invoiceId`: positive integer.
- Body schema for `POST /invoices/:invoiceId/resend`:
  - `channel`: optional enum `['WHATSAPP', 'EMAIL']`.

### Task 2: Controller Implementation (`backend/src/modules/invoice/invoice.controller.ts`)
- `listInvoices(req, res)`:
  - If role is `RETAILER`, forces `retailerId = req.user.userId`. If retailer provides `retailerId` in query that differs, reject or ignore.
  - Calls `invoiceService.listInvoices(...)`.
  - Returns envelope with `INVOICES_RETRIEVED` and pagination metadata.
- `getInvoiceById(req, res)`:
  - Validates `invoiceId`.
  - Fetches invoice with lines, billed_to snapshot, financial totals, and notification logs.
  - If role is `RETAILER`, checks `invoice.retailer_id === req.user.userId`. If not, throws 404 `NOT_FOUND` (tenant isolation).
  - Returns envelope `INVOICE_RETRIEVED`.
- `getInvoicePdf(req, res)`:
  - Validates `invoiceId` and tenant ownership.
  - Calls `storageService.getInvoicePdfSignedUrl(invoice.pdf_path, 300)`.
  - Returns envelope `INVOICE_PDF_URL_GENERATED` with `{ url, expiresIn: 300 }`.
- `resendInvoice(req, res)`:
  - Requires `ADMIN` role.
  - Calls `notificationService.sendInvoiceNotification(invoiceId, { forceChannel: req.body.channel })`.
  - Returns `202 Accepted` with code `NOTIFICATION_RESENT` and updated logs array.

### Task 3: Routes & Express Registration (`backend/src/modules/invoice/invoice.routes.ts`)
- Mount routes:
  - `GET /api/v1/invoices` -> `authenticate`, `requireAnyRole(['ADMIN', 'RETAILER'])`, `invoiceController.listInvoices`.
  - `GET /api/v1/invoices/:invoiceId` -> `authenticate`, `requireAnyRole(['ADMIN', 'RETAILER'])`, `invoiceController.getInvoiceById`.
  - `GET /api/v1/invoices/:invoiceId/pdf` -> `authenticate`, `requireAnyRole(['ADMIN', 'RETAILER'])`, `invoiceController.getInvoicePdf`.
  - `POST /api/v1/invoices/:invoiceId/resend` -> `authenticate`, `requireRole('ADMIN')`, `invoiceController.resendInvoice`.
- Register router in `backend/src/routes/index.ts` or `backend/src/app.ts`.

### Task 4: API Integration Tests (`backend/src/modules/invoice/__tests__/invoice-api.test.ts`)
- Test cases:
  1. `GET /invoices` as Admin returns all invoices with pagination and date filtering.
  2. `GET /invoices` as Retailer A returns only Retailer A's invoices.
  3. `GET /invoices/:id` as Retailer B requesting Retailer A's invoice returns 404 `NOT_FOUND`.
  4. `GET /invoices/:id/pdf` returns signed URL with 300s expiration.
  5. `POST /invoices/:id/resend` as Retailer is forbidden (403); as Admin succeeds with 202 and returns updated notification logs.

---

## 3. Verification Criteria

- [ ] All 4 endpoints return standardized API envelopes `{ success, code, message, data, meta }`.
- [ ] Strict tenant isolation prevents cross-pharmacy invoice leaks.
- [ ] Admin resend endpoint correctly triggers dispatches and returns 202 Accepted.
- [ ] Automated integration tests pass cleanly with `npm test`.
