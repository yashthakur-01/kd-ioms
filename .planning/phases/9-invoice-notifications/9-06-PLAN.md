# Plan 9-06: Frontend Invoices UI & Verification

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-06`  
**Wave:** 6 (Frontend UI Integration & Full Verification)  
**Dependencies:** Plan 9-04, Plan 9-05  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Build the frontend UI components and pages for Invoices: API client & React Query hooks, Retailer Order View invoice download button, Admin Invoices management page (`/admin/invoices`) with date/retailer filters, Invoice Details Drawer with live notification timeline, Admin Resend dialog, and execute the full Phase 9 regression suite.

---

## 2. Tasks & Detailed Instructions

### Task 1: Frontend API Client & Hooks (`frontend/src/lib/api/invoice.api.ts`)
- Implement:
  - `getInvoices(params)`: calls `GET /api/v1/invoices`.
  - `getInvoiceById(id)`: calls `GET /api/v1/invoices/:id`.
  - `getInvoicePdfUrl(id)`: calls `GET /api/v1/invoices/:id/pdf`.
  - `resendInvoiceNotification(id, channel)`: calls `POST /api/v1/invoices/:id/resend`.
- React Query hooks (`useInvoices`, `useInvoiceDetail`, `useInvoicePdf`, `useResendNotification`).

### Task 2: Retailer Invoices Integration
- In Retailer Order Detail view (`frontend/src/app/(retailer)/orders/[orderId]/page.tsx` or components):
  - When order status is `DELIVERED`, display "Download Tax Invoice" button.
  - Clicking triggers `getInvoicePdfUrl` and opens the signed link in a new tab or triggers download.
- Retailer Invoices list view at `/invoices` or tab within `/orders`:
  - Shows invoice number, order number, delivered date, grand total, and download action.

### Task 3: Admin Invoices Management Screen (`frontend/src/app/(admin)/invoices/page.tsx`)
- Table of wholesale invoices:
  - Columns: Invoice #, Date, Order #, Pharmacy Name, Subtotal, GST, Total (₹), Notification Status Badge (`WHATSAPP SENT`, `EMAIL SENT`, `FAILED`, `PENDING`), Actions.
  - Filter bar: Date range picker (`From` / `To`), Retailer search/select dropdown.
  - Action buttons: "Download PDF" (opens signed link), "View Details" (opens detail drawer).

### Task 4: Invoice Detail Drawer & Notification Timeline (`frontend/src/components/invoices/InvoiceDetailDrawer.tsx`)
- Shows:
  - Pharmacy snapshot (`billed_to`): Shop Name, DL Numbers, GSTIN, Address, Phone.
  - Items breakdown: Medicine, Pack, Batch, Expiry, Qty, Unit Rate, Total Amount.
  - Financial summary: Subtotal, GST (aggregate), Round-off, Grand Total.
  - Multi-Channel Notification Timeline:
    - Step 1: WhatsApp dispatch (timestamp, status badge, provider ID or failure reason).
    - Step 2: Email dispatch (if fallback triggered, timestamp, status, error).
  - Admin "Resend Notification" action button:
    - Opens confirm modal with channel select (`Automatic Fallback`, `WhatsApp Only`, `Email Only`).
    - Submits and updates notification timeline with optimistic / invalidated query refresh.

### Task 5: Admin Order Detail Integration
- In Admin Order Detail (`/admin/orders/[orderId]`):
  - When delivered, shows Invoice pill with notification status badge (e.g. green WhatsApp icon, red alert if failed) linking directly to the invoice detail.

### Task 6: Full Verification & Build Checks
- Run all backend vitest tests: `cd backend && npm test`.
- Run frontend component tests: `cd frontend && npm test`.
- Run TypeScript linter: `cd backend && npm run lint` and `cd frontend && npm run lint`.
- Run production build checks: `cd backend && npm run build` and `cd frontend && npm run build`.

---

## 3. Verification Criteria

- [ ] Retailer can easily download their GST invoice PDF for delivered orders.
- [ ] Admin invoices screen provides filtering, PDF downloads, and detailed inspection.
- [ ] Notification status timeline clearly shows WhatsApp status and Email fallback logs.
- [ ] Admin resend button successfully triggers dispatches.
- [ ] All automated tests pass across backend and frontend (`npm test` clean).
- [ ] TypeScript and Next.js production builds compile cleanly with 0 errors (`npm run build`).
