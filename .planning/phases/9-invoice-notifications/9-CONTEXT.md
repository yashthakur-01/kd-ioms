# Phase 9 Context: Invoicing and Multi-Channel Notifications

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Responsible Developer:** `dev3`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 9`)  
**Primary Source:** [`tech.md`](file:///home/buddy/sandarp/kd-ioms/tech.md) Section 14, Section 2.1, Section 2.8, Section 2.9, Section 13.3, and [`ROADMAP.md`](file:///home/buddy/sandarp/kd-ioms/.planning/ROADMAP.md) Phase 9  

---

## 1. Phase Objective & Boundary

When an order transition to `DELIVERED` commits, an official wholesale GST tax invoice is generated with an Indian Financial Year sequence (`INV/YYYY-YY/00001`), single GST calculation, and integer rupee round-off. A PDF is rendered via PDFKit, stored in private Supabase Storage (with local disk fallback), and dispatched to the pharmacy retailer via WhatsApp Cloud API with automatic email fallback via Nodemailer SMTP. Admin has full visibility into invoice records and delivery notifications, with ability to resend or retry.

1. **Delivery Hook & Invoice Creation:**
   - Triggered post-commit when `deliveryService.completeDelivery` successfully delivers an order (`DELIVERED` status with >= 1 accepted line item).
   - Read ONLY accepted items and their underlying allocations. (100% refused orders transition to `REJECTED` and produce NO invoice).
   - Invoice creation is idempotent on `order_id`: repeat calls return the existing invoice without duplicate sequence increments.
   - Failures during PDF rendering or message dispatch never roll back or alter the completed delivery state.

2. **Invoice Numbering & Financial Year Scoping:**
   - Formatted as `INV/YYYY-YY/00001` based on Indian Financial Year (April 1 to March 31 IST).
   - E.g., `2026-03-31` belongs to `2025-26` -> `INV/2025-26/00001`.
   - `2026-04-01` belongs to `2026-27` -> `INV/2026-27/00001`.
   - Sequence resets per financial year, tracked in `document_sequences` via year-scoped key (e.g. `INV_2026-27`).

3. **Tax & Financial Math:**
   - Calculated using integer paise mathematics (`utils/money.ts`).
   - Line amount = `quantity × unit_price_excl_gst`.
   - Single GST figure aggregate = sum of per-allocation GST amounts.
   - Round-off to nearest rupee: `round_off = roundHalfUp(subtotal + gst) - (subtotal + gst)`.
   - Total payable is an exact integer rupee amount.
   - Billed-to captures immutable retailer profile snapshot (shop name, GSTIN, DL number, address, phone).

4. **PDF Generation (PDFKit):**
   - Clean, professional wholesale pharmaceutical tax invoice layout.
   - Kandarp Drugs seller profile from `app_settings.business_profile` (name, address, GSTIN, DL number, contact).
   - Pharmacy buyer profile from `billed_to`.
   - Invoice number, invoice date (IST), order number, order date.
   - Item table: Medicine Name, Pack Size, Batch No, Expiry Date, Quantity, MRP, Unit Rate, Line Amount.
   - Summary block: Subtotal, Single GST Aggregate, Round-off, Grand Total (₹), and Amount in Words.
   - Uploaded to private storage bucket `invoices` (or `uploads/invoices` fallback).
   - Access controlled via short-lived signed URLs (`GET /invoices/:invoiceId/pdf`, expires in 300s).

5. **Multi-Channel Notification Cascade:**
   - Primary: WhatsApp Meta Cloud API template message with invoice PDF link and summary.
   - Fallback: If WhatsApp fails, log failure reason, insert `EMAIL` row, and dispatch via Nodemailer SMTP.
   - Providers: `whatsapp.provider.ts` and `email.provider.ts` isolated under `notification/providers/`.
   - Development/CI simulator: When live credentials (`WHATSAPP_ACCESS_TOKEN`, `SMTP_HOST`) are absent, mock providers log actions and simulate success (or configurable error for fallback testing).
   - Scheduled retry worker: `jobs/notification-retry.ts` picks non-SENT rows with < 3 attempts and retries with backoff.
   - Manual admin resend: `POST /invoices/:invoiceId/resend`.

6. **Frontend Integration:**
   - **Retailer Experience:**
     - Order Details view shows download invoice button and signed link for delivered orders.
     - Retailer Invoices list view at `/retailer/invoices` (or orders tab).
   - **Admin Experience:**
     - Invoices list view at `/admin/invoices` with date filters, retailer filter, and download links.
     - Invoice detail view with itemized charges, PDF preview, and live notification status timeline.
     - "Resend Notification" modal/button supporting channel override.
     - Failed dispatch badge on Admin Order view.

---

## 2. Key Architecture Decisions Log

| Decision ID | Area | Decision Summary | Source Reference |
| :---: | :--- | :--- | :--- |
| **ADR-039** | FY Invoice Sequence | Invoices use Indian Fiscal Year format `INV/YYYY-YY/00001` (April 1 to March 31). Sequences are scoped per fiscal year in `document_sequences` (code `INV_YYYY-YY`), resetting to 1 on April 1st. Migration `005_invoice_sequences.sql` widens `document_sequences.code` to `VARCHAR(32)`. | User Alignment / `tech.md` 14.3 |
| **ADR-040** | Single GST & Rupee Round-Off | Invoices aggregate all line items into a single GST summary line. Total amount rounds half-up to the nearest integer rupee (`round_off = roundHalfUp(subtotal + gst) - (subtotal + gst)`). Invoices include strictly accepted lines; refused lines are excluded from invoicing. | `tech.md` 14.3, 2.9 |
| **ADR-041** | Decoupled Post-Commit Hook | Delivery transaction commits first. Then, `invoiceService.generate` executes post-commit and dispatches notifications asynchronously. Any failure during PDF compilation or message transport never invalidates or rolls back the delivery. | `tech.md` 14.3, 14.4 |
| **ADR-042** | Cascade Notification & Fallback | Delivery triggers WhatsApp template message first. If WhatsApp fails, status is marked `FAILED` with provider error, an `EMAIL` attempt is created immediately, and sent via Nodemailer. A background worker retries open rows up to 3 attempts. Admin can trigger immediate resend via `POST /invoices/:invoiceId/resend`. | `tech.md` 14.3, 14.4 |
| **ADR-043** | Private Storage & Signed URLs | Invoice PDFs are stored in private Supabase Storage (`invoices` bucket) with local filesystem fallback (`uploads/invoices`). Files are never publicly readable; clients obtain temporary signed URLs (300s TTL) with strict tenant ownership validation. | `tech.md` 14.2, ADR-036 |

---

## 3. Database Schema & Migration `005_invoice_sequences.sql`

Existing tables in `001_init.sql` already define `invoices`, `notification_logs`, and `document_sequences`.  
To support fiscal-year-scoped keys like `INV_2026-27`:

```sql
-- Migration 005_invoice_sequences.sql
ALTER TABLE document_sequences ALTER COLUMN code TYPE VARCHAR(32);

-- Function to obtain next number for a specific financial year
CREATE OR REPLACE FUNCTION next_invoice_number_for_fy(p_fy VARCHAR) RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(32) := 'INV_' || p_fy;
  v_val INT;
BEGIN
  UPDATE document_sequences
  SET current_val = current_val + 1
  WHERE code = v_code
  RETURNING current_val INTO v_val;

  IF NOT FOUND THEN
    INSERT INTO document_sequences (code, current_val)
    VALUES (v_code, 1)
    RETURNING current_val INTO v_val;
  END IF;

  RETURN 'INV/' || p_fy || '/' || LPAD(v_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
```

---

## 4. API Endpoints Specification

### 4.1 `GET /api/v1/invoices`
- **Auth:** `ADMIN` or `RETAILER` (retailer restricted to own invoices).
- **Query Parameters:** `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `retailerId` (UUID, Admin only), `page` (default 1), `pageSize` (default 20).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "INVOICES_RETRIEVED",
    "message": "Invoices retrieved successfully",
    "data": [
      {
        "invoiceId": 12,
        "invoiceNumber": "INV/2026-27/00001",
        "orderId": 45,
        "orderNumber": "ORD-000045",
        "retailerId": "uuid-retailer",
        "shopName": "Apollo Pharmacy",
        "subtotal": "2100.00",
        "gstAmount": "252.00",
        "roundOff": "0.00",
        "total": "2352.00",
        "generatedAt": "2026-10-20T10:00:00.000Z",
        "latestNotification": {
          "channel": "WHATSAPP",
          "status": "SENT"
        }
      }
    ],
    "meta": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
  ```

### 4.2 `GET /api/v1/invoices/:invoiceId`
- **Auth:** `ADMIN` or `RETAILER` (owner).
- **Params:** `invoiceId` (positive integer).
- **Response `200 OK`:** Full invoice breakdown with line items (medicine, batch, expiry, quantity, MRP, unit price, GST rate, line total), business profile header, billed-to profile snapshot, financial totals, and notification log history.

### 4.3 `GET /api/v1/invoices/:invoiceId/pdf`
- **Auth:** `ADMIN` or `RETAILER` (owner).
- **Params:** `invoiceId` (positive integer).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "INVOICE_PDF_URL_GENERATED",
    "message": "Signed PDF download URL generated successfully",
    "data": {
      "url": "https://storage.supabase.co/signed/... or /api/v1/invoices/12/download?token=...",
      "expiresIn": 300
    }
  }
  ```

### 4.4 `POST /api/v1/invoices/:invoiceId/resend`
- **Auth:** `ADMIN` only.
- **Params:** `invoiceId` (positive integer).
- **Body:** `{ channel?: "WHATSAPP" | "EMAIL" }` (optional).
- **Response `202 Accepted`:**
  ```json
  {
    "success": true,
    "code": "NOTIFICATION_RESENT",
    "message": "Invoice notification dispatch queued",
    "data": {
      "invoiceId": 12,
      "logs": [
        {
          "logId": 88,
          "channel": "WHATSAPP",
          "status": "SENT",
          "attempts": 1,
          "providerMessageId": "wamid.HBg..."
        }
      ]
    }
  }
  ```

---

## 5. Module Architecture

```
backend/src/
├── modules/
│   ├── invoice/
│   │   ├── invoice.types.ts       # DTOs, schemas, validation
│   │   ├── invoice.service.ts     # Generation, tax math, FY sequencing, storage
│   │   ├── invoice.controller.ts  # HTTP routes handler
│   │   ├── invoice.pdf.ts         # PDFKit template & buffer compilation
│   │   └── invoice.routes.ts      # Express router
│   └── notification/
│       ├── notification.types.ts  # Channel enums, log DTOs
│       ├── notification.service.ts# Dispatch cascade (WA -> Email), retry caller
│       ├── notification.routes.ts # Notification management if needed
│       └── providers/
│           ├── whatsapp.provider.ts # Meta WhatsApp Cloud API (+ mock simulator)
│           └── email.provider.ts    # Nodemailer SMTP (+ mock simulator)
├── jobs/
│   └── notification-retry.ts      # Cron/interval worker for failed attempts
└── utils/
    └── storage.ts                 # uploadInvoicePdf, getInvoicePdfSignedUrl
```

---

## 6. Testing Strategy & Verification Gates

1. **FY Rollover Sequence Test (`unit`):**
   - Invoices generated on `2026-03-31` generate `INV/2025-26/00001`.
   - Invoices generated on `2026-04-01` generate `INV/2026-27/00001` (counter resets).
2. **GST Math & Integer Rupee Round-Off Test (`unit`):**
   - Mixed GST rates (e.g. 5% and 12%) across accepted allocations.
   - Verifies subtotal + single GST aggregate + round-off equals exact integer total rupees.
3. **Delivery Completion Integration Test (`integration`):**
   - Delivering an order triggers invoice generation post-commit.
   - Repeating delivery completion call does not create duplicate invoice (returns existing).
   - 100% refused order (`REJECTED`) creates zero invoice.
4. **WhatsApp to Email Fallback Test (`integration`):**
   - Simulated WhatsApp API failure generates a `FAILED` log with error details.
   - Immediately creates `EMAIL` log row and dispatches through Nodemailer.
5. **Retry Job Termination Test (`integration`):**
   - Background retry worker retries failed logs up to 3 attempts, then terminates with status `FAILED`.
6. **Tenant Isolation Test (`integration`):**
   - Retailer A cannot access invoice details or signed PDF URL for Retailer B (returns 404 `NOT_FOUND`).
