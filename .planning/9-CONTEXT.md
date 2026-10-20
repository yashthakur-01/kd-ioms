# Phase 9 Context: Invoicing and Multi-Channel Notifications

*See full details at [`.planning/phases/9-invoice-notifications/9-CONTEXT.md`](.planning/phases/9-invoice-notifications/9-CONTEXT.md)*

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Responsible Developer:** `dev3`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 9`)  

### Key Decisions Locked:
1. **Fiscal Year Invoice Sequence (ADR-039):** Invoices use Indian Fiscal Year format `INV/YYYY-YY/00001` (April 1 to March 31). Sequences are scoped per fiscal year in `document_sequences` (code `INV_YYYY-YY`), resetting to 1 on April 1st. Migration `005_invoice_sequences.sql` widens `document_sequences.code` to `VARCHAR(32)`.
2. **Single GST & Rupee Round-Off (ADR-040):** Invoices aggregate all line items into a single GST summary line. Total amount rounds half-up to the nearest integer rupee (`round_off = roundHalfUp(subtotal + gst) - (subtotal + gst)`). Invoices include strictly accepted lines; refused lines are excluded from invoicing.
3. **Decoupled Post-Commit Hook (ADR-041):** Delivery transaction commits first. Then, `invoiceService.generate` executes post-commit and dispatches notifications asynchronously. Any failure during PDF compilation or message transport never invalidates or rolls back the delivery.
4. **Cascade Notification & Fallback (ADR-042):** Delivery triggers WhatsApp template message first. If WhatsApp fails, status is marked `FAILED` with provider error, an `EMAIL` attempt is created immediately, and sent via Nodemailer. A background worker retries open rows up to 3 attempts. Admin can trigger immediate resend via `POST /invoices/:invoiceId/resend`.
5. **Private Storage & Signed URLs (ADR-043):** Invoice PDFs are stored in private Supabase Storage (`invoices` bucket) with local filesystem fallback (`uploads/invoices`). Files are never publicly readable; clients obtain temporary signed URLs (300s TTL) with strict tenant ownership validation.
