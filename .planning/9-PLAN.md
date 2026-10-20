# Phase 9 Plan: Invoicing and Multi-Channel Notifications

*See full master plan and wave breakdown at [`.planning/phases/9-invoice-notifications/9-PLAN.md`](.planning/phases/9-invoice-notifications/9-PLAN.md)*

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Responsible Developer:** `dev3`  
**Status:** 📋 READY FOR EXECUTION  

### Wave Breakdown:
- **Wave 1 (`9-01`):** FY Sequence Migration & Storage Integration (`005_invoice_sequences.sql`, `uploadInvoicePdf`, `getInvoicePdfSignedUrl`, FY rollover unit tests)
- **Wave 2 (`9-02`):** PDFKit Wholesale Invoice Template Engine (`invoice.pdf.ts`, header with business & buyer profiles, batch table, single GST line, round-off)
- **Wave 3 (`9-03`):** Invoice Generation Service & Delivery Hook (`invoice.service.ts`, accepted lines filter, integer paise tax math, post-commit hook in `delivery.service.ts`)
- **Wave 4 (`9-04`):** Multi-Channel Cascade Notification Service & Providers (`whatsapp.provider.ts`, `email.provider.ts`, fallback cascade, `jobs/notification-retry.ts`)
- **Wave 5 (`9-05`):** Invoices HTTP Endpoints & Admin Resend (`GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/pdf`, `POST /invoices/:id/resend`, tenant isolation)
- **Wave 6 (`9-06`):** Frontend Invoices UI & Verification (`invoice.api.ts`, `/admin/invoices`, notification timeline, resend modal, regression test suite)
