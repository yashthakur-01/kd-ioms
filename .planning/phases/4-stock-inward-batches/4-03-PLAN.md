# Plan 4-03: Batch Management & Adjustments API

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-03`  
**Wave:** 3  
**Dependencies:** Plan `4-01`, Plan `4-02`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the batch management endpoints (`GET /batches`, `GET /batches/:batchId`, `PATCH /batches/:batchId`), stock adjustment workflow (`POST /batches/:batchId/adjust` with `EXPIRY_WRITEOFF` guard and reason logging), and the global stock ledger audit endpoint (`GET /stock/ledger`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Validation Schemas (`backend/src/modules/batch/batch.validation.ts`)
1. Create `backend/src/modules/batch/batch.validation.ts`:
   - `listBatchesSchema`:
     - `query`:
       - `medicineId`: `z.coerce.number().int().positive().optional()`
       - `status`: `z.enum(BATCH_STATUS_VALUES).optional()`
       - `expiry`: `z.enum(['ALL', 'NEAR', 'EXPIRED']).optional().default('ALL')`
       - `inStock`: `z.enum(['true', 'false']).transform((v) => v === 'true').optional()`
       - `q`: `z.string().trim().max(100).optional()`
       - `sort`: `z.enum(['expiryDate', '-expiryDate', 'createdAt', '-createdAt', 'batchNumber', '-batchNumber']).optional().default('expiryDate')`
       - Pagination: `page` (default 1), `pageSize` (default 20, max 100)
     - `.strict()`
   - `getBatchSchema`:
     - `params`: `z.object({ batchId: z.coerce.number().int().positive() }).strict()`
   - `updateBatchSchema`:
     - `params`: `z.object({ batchId: z.coerce.number().int().positive() }).strict()`
     - `body`:
       - `sellingPrice`: `z.string().regex(/^\d+(\.\d{1,2})?$/).optional()`
       - `status`: `z.enum(BATCH_STATUS_VALUES).optional()`
     - `.strict()`
     - Refinement: at least one field (`sellingPrice` or `status`) provided.
   - `adjustBatchSchema`:
     - `params`: `z.object({ batchId: z.coerce.number().int().positive() }).strict()`
     - `body`:
       - `type`: `z.enum(['DAMAGE', 'CORRECTION', 'EXPIRY_WRITEOFF'], { message: 'Adjustment type must be DAMAGE, CORRECTION, or EXPIRY_WRITEOFF' })`
       - `quantity`: `z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero')`
       - `reason`: `z.string().trim().min(5, 'Reason must be at least 5 characters').max(300, 'Reason cannot exceed 300 characters')`
     - `.strict()`
   - `listLedgerSchema`:
     - `query`:
       - `batchId`: `z.coerce.number().int().positive().optional()`
       - `medicineId`: `z.coerce.number().int().positive().optional()`
       - `type`: `z.enum(LEDGER_ENTRY_TYPE_VALUES).optional()`
       - `from`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()`
       - `to`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()`
       - Pagination: `page`, `pageSize`
     - `.strict()`

### Task 2: Batch Service (`backend/src/modules/batch/batch.service.ts`)
1. Implement `listBatches(query)`:
   - Builds SQL query joining `batches b` and `medicines m ON b.medicine_id = m.medicine_id`.
   - Filters:
     - `medicineId`: `b.medicine_id = $x`
     - `status`: `b.status = $x`
     - `expiry`:
       - `'NEAR'`: `b.expiry_date >= today_ist() AND b.expiry_date <= today_ist() + 90`
       - `'EXPIRED'`: `b.expiry_date < today_ist()`
       - `'ALL'`: no filter
     - `inStock`: `b.quantity_on_hand > 0`
     - `q`: `(b.batch_number ILIKE $x OR m.name ILIKE $x)`
   - Computes:
     - `daysLeft`: `EXTRACT(DAY FROM (b.expiry_date - today_ist()))::int`
     - `priceInclGst`: `ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2)`
   - Returns `{ rows, totalItems }`.
2. Implement `getBatchById(batchId)`:
   - Queries batch with medicine details.
   - Queries last 20 entries from `stock_ledger_entries sle JOIN users u ON sle.created_by = u.id WHERE batch_id = $1 ORDER BY sle.created_at DESC LIMIT 20`.
   - Returns `{ batch, ledgerEntries }`.
3. Implement `updateBatch(batchId, { sellingPrice?, status? })`:
   - Runs in transaction with batch row lock.
   - If `sellingPrice`:
     - Load batch and linked medicine `gst_rate`.
     - Verify `effectivePrice <= batch.mrp` -> if exceeded, throw 422 `PRICE_EXCEEDS_MRP`.
     - Update `selling_price`.
   - If `status`:
     - Update `status`.
   - Returns updated batch.
4. Implement `adjustBatch(batchId, { type, quantity, reason }, user)`:
   - Run inside `withTransaction(async (client) => { ... })`:
     - Fetch batch: `SELECT * FROM batches WHERE batch_id = $1 FOR UPDATE`.
     - If not found -> throw 404 `NOT_FOUND`.
     - If `type === 'EXPIRY_WRITEOFF'`:
       - Check `batch.expiry_date < todayIst()`.
       - If batch has NOT expired -> throw `ConflictError({ code: 'INVALID_STATE_TRANSITION', message: 'Cannot perform expiry write-off on an unexpired batch' })`.
       - Enforce negative delta: if `quantity > 0`, delta = `-quantity`; else delta = `quantity`.
     - If `type === 'DAMAGE'`:
       - Enforce negative delta: if `quantity > 0`, delta = `-quantity`; else delta = `quantity`.
     - If `type === 'CORRECTION'`:
       - Delta is the exact signed adjustment amount (`quantity`).
     - Call `applyLedgerEntry(client, { batchId, type, delta, reason, userId: user.userId })`.
     - Return `{ batch: updatedBatch, ledgerEntry }`.
5. Implement `listLedger(query)`:
   - Queries `stock_ledger_entries sle JOIN batches b ON sle.batch_id = b.batch_id JOIN medicines m ON b.medicine_id = m.medicine_id LEFT JOIN users u ON sle.created_by = u.id`.
   - Returns paginated list of movements.

### Task 3: Controllers & Routes (`backend/src/modules/batch/`)
1. Create `batch.controller.ts`:
   - `handleListBatches`, `handleGetBatch`, `handleUpdateBatch`, `handleAdjustBatch`, `handleListLedger`.
2. Create `batch.route.ts`:
   - Protected by `authenticate`, `authorize([USER_ROLE.ADMIN])`, `requirePasswordChanged`.
   - Mount routes:
     - `GET /batches` -> `validate(listBatchesSchema)`, `handleListBatches`
     - `GET /batches/:batchId` -> `validate(getBatchSchema)`, `handleGetBatch`
     - `PATCH /batches/:batchId` -> `validate(updateBatchSchema)`, `handleUpdateBatch`
     - `POST /batches/:batchId/adjust` -> `validate(adjustBatchSchema)`, `handleAdjustBatch`
     - `GET /stock/ledger` -> `validate(listLedgerSchema)`, `handleListLedger`
   - Wire into main router at `/api/v1/batches` and `/api/v1/stock/ledger`.

### Task 4: Integration Tests (`backend/src/modules/batch/__tests__/batch.integration.test.ts`)
1. Create integration tests:
   - List batches with filters: `status`, `expiry=NEAR` (90d), `expiry=EXPIRED`, `inStock`.
   - Get batch detail with last 20 ledger movements.
   - Update batch selling price validates price incl. GST <= MRP.
   - Adjust batch (`DAMAGE`) correctly decrements stock and writes ledger row.
   - Adjust batch (`EXPIRY_WRITEOFF`) on unexpired batch is refused with 409 `INVALID_STATE_TRANSITION`.
   - Adjust batch (`EXPIRY_WRITEOFF`) on expired batch succeeds.
   - Stock ledger endpoint filters by batch, medicine, type, and date range.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] `GET /api/v1/batches` provides accurate filtering for Near Expiry (<=90d) and Expired stock.
- [ ] `POST /api/v1/batches/:batchId/adjust` applies `DAMAGE`, `CORRECTION`, and `EXPIRY_WRITEOFF`.
- [ ] Attempting expiry write-off on unexpired batch triggers 409 `INVALID_STATE_TRANSITION`.
- [ ] Mandatory adjustment reason (5–300 chars) enforced.
- [ ] `GET /api/v1/stock/ledger` returns paginated audit log of movements.
- [ ] Integration tests pass cleanly (`npm test`).
