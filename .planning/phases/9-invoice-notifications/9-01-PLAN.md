# Plan 9-01: FY Sequence Migration & Storage Integration

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-01`  
**Wave:** 1 (Sequencing & Storage Foundation)  
**Dependencies:** Phase 0, Phase 8  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Implement database migration `005_invoice_sequences.sql` to support Indian Financial Year scoped sequence tracking (e.g. `INV_2026-27`), create the PostgreSQL function `next_invoice_number_for_fy`, extend `backend/src/utils/dates.ts` if needed, and add PDF storage upload and signed URL generators to `backend/src/utils/storage.ts` with local filesystem fallback for CI/offline testing.

---

## 2. Tasks & Detailed Instructions

### Task 1: Migration `backend/migrations/005_invoice_sequences.sql`
- Widen `document_sequences.code` column from `VARCHAR(10)` to `VARCHAR(32)` to allow keys like `INV_2026-27`.
- Create function `next_invoice_number_for_fy(p_fy VARCHAR)`:
  ```sql
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

### Task 2: Storage Utilities for Invoices (`backend/src/utils/storage.ts`)
- Implement `uploadInvoicePdf(buffer: Buffer, invoiceNumber: string): Promise<string>`:
  - Sanitizes invoice number for safe filename (e.g., `INV/2026-27/00001` -> `INV_2026-27_00001.pdf`).
  - **Cloud upload:** If `env.SUPABASE_URL` and `env.SUPABASE_SERVICE_ROLE_KEY` are present:
    - Upload buffer to bucket `env.SUPABASE_STORAGE_BUCKET` (default: `'invoices'`) with content-type `application/pdf`.
    - Returns bucket path (e.g., `invoices/INV_2026-27_00001.pdf`).
  - **Local disk fallback:**
    - Ensures directory `uploads/invoices` exists.
    - Saves buffer to `uploads/invoices/${filename}`.
    - Returns `uploads/invoices/${filename}`.
- Implement `getInvoicePdfSignedUrl(pdfPath: string, expiresInSeconds = 300): Promise<string>`:
  - If cloud: uses Supabase storage `createSignedUrl(objectPath, expiresInSeconds)`.
  - If local disk: returns relative download path `/api/v1/invoices/download?file=${encodeURIComponent(pdfPath)}` or returns local path for streaming.

### Task 3: Unit Tests (`backend/src/modules/invoice/__tests__/sequence-storage.test.ts`)
- Test cases:
  1. `next_invoice_number_for_fy('2025-26')` generates `INV/2025-26/00001`, then `INV/2025-26/00002`.
  2. Switching to `2026-27` resets counter and generates `INV/2026-27/00001`.
  3. `financialYearOf` in `dates.ts` returns `2025-26` on March 31, 2026 and `2026-27` on April 1, 2026.
  4. `uploadInvoicePdf` saves PDF buffer and returns valid path in both local fallback and mock Supabase modes.
  5. `getInvoicePdfSignedUrl` returns valid temporary URL.

---

## 3. Verification Criteria

- [ ] Migration `005_invoice_sequences.sql` runs cleanly via `npm run db:migrate`.
- [ ] Sequence generation respects FY rollover and increments sequentially.
- [ ] PDF storage handles uploads and generates signed URLs.
- [ ] Unit tests pass cleanly with `npm test`.
