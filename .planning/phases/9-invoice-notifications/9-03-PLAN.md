# Plan 9-03: Invoice Generation Service & Delivery Hook

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-03`  
**Wave:** 3 (Core Service & Post-Commit Delivery Integration)  
**Dependencies:** Plan 9-01, Plan 9-02  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Implement `invoice.service.ts` to compute financial totals using integer paise arithmetic, generate the next fiscal year sequence number, capture the buyer snapshot, store invoice records in PostgreSQL, trigger PDF generation & storage, and integrate post-commit with `delivery.service.ts` so that completing an order delivery automatically generates an invoice.

---

## 2. Tasks & Detailed Instructions

### Task 1: Invoice DTOs & Types (`backend/src/modules/invoice/invoice.types.ts`)
- Define DTOs:
  - `InvoiceDto`: full representation of an invoice record including lines, totals, billed_to snapshot, and notification logs.
  - `InvoiceLineDto`: line item with batch, expiry, quantity, MRP, unit rate, GST rate, line total.
  - `InvoiceSummaryDto`: list view item for cataloging.

### Task 2: Invoice Generation Service (`backend/src/modules/invoice/invoice.service.ts`)
- Implement `generateInvoice(orderId: number): Promise<InvoiceDto>`:
  - **Idempotency Guard:** Query `SELECT * FROM invoices WHERE order_id = $1`. If exists, return existing invoice (do NOT re-increment sequence).
  - Verify order exists and has `status = 'DELIVERED'`.
  - Fetch order items and their allocations where `delivery_status = 'ACCEPTED'`.
  - If no accepted lines (or order is `REJECTED`), throw `InvalidStateTransitionError` or return null.
  - Compute financial totals via `money.ts`:
    - For each accepted allocation:
      - `lineSellingPricePaise = toPaise(batch.selling_price)`
      - `lineTotalPaise = lineSellingPricePaise * allocation.quantity`
      - `lineGstPaise = calculateGstAmount(lineTotalPaise, medicine.gst_rate)`
    - `subtotalPaise = sum(lineTotalPaise)`
    - `gstAmountPaise = sum(lineGstPaise)`
    - `roundOffPaise = roundHalfUp(subtotalPaise + gstAmountPaise) - (subtotalPaise + gstAmountPaise)`
    - `totalPaise = subtotalPaise + gstAmountPaise + roundOffPaise`
  - Fetch retailer details from `retailer_profiles` + `users` and build `billed_to` JSON snapshot.
  - Fetch business profile from `app_settings` (key: `'business_profile'`).
  - Determine Indian Financial Year for today IST (`financialYearOf(todayIst())`).
  - Obtain invoice number via SQL: `SELECT next_invoice_number_for_fy($1)`.
  - Insert record into `invoices` table:
    - `invoice_number`, `order_id`, `retailer_id`, `billed_to`, `subtotal`, `gst_amount`, `round_off`, `total`.
  - Build PDF buffer via `buildInvoicePdf`.
  - Upload PDF via `uploadInvoicePdf(buffer, invoiceNumber)` and update `invoices.pdf_path`.
  - Return created `InvoiceDto`.

### Task 3: Delivery Hook Integration (`backend/src/modules/delivery/delivery.service.ts`)
- In `completeDelivery`:
  - After `withTransaction` completes and commits:
    - If `order.status === 'DELIVERED'`:
      - Execute `invoiceService.generateInvoice(orderId)` inline post-commit.
      - Catch any error during invoice generation and log it (`logger.error`) without letting it throw or alter the completed delivery response.
      - Return the generated invoice summary in the delivery completion result payload.

### Task 4: Integration Tests (`backend/src/modules/invoice/__tests__/invoice-service.test.ts`)
- Test cases:
  1. Delivery completion with accepted items creates an invoice with status `DELIVERED`, sequence `INV/2026-27/00001`, and stored PDF path.
  2. Repeat calls to `generateInvoice(orderId)` return the existing invoice without advancing sequence counter.
  3. Refusing 100% of items at doorstep transitions order to `REJECTED` and creates zero invoices.
  4. Partial refusal: only accepted lines are included in the invoice; refused lines are excluded.
  5. Single GST aggregate correctly sums per-allocation taxes and round-off yields exact integer rupees.

---

## 3. Verification Criteria

- [ ] `generateInvoice` executes cleanly post-commit and generates proper tax totals.
- [ ] Repeat calls are completely idempotent.
- [ ] Excluded refused items never appear in the invoice or GST calculation.
- [ ] Integration tests pass cleanly with `npm test`.
