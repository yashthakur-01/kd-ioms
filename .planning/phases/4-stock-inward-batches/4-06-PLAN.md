# Plan 4-06: End-to-End Integration Verification & Phase Sign-Off

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-06`  
**Wave:** 6 (Verification & Sign-Off)  
**Dependencies:** Plan `4-01`, Plan `4-02`, Plan `4-03`, Plan `4-04`, Plan `4-05`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Execute comprehensive multi-role verification of the physical stock inward lifecycle, concurrent batch top-ups, append-only ledger integrity, price ceiling enforcement, packaging scan heuristics, batch adjustments, and near-expiry filtering before signing off on Phase 4.

---

## 2. Tasks & Detailed Instructions

### Task 1: Complete Stock Inward & Ledger Verification Walkthrough
1. **Medicine Preconditions:**
   - Verify an active medicine exists with a known GST rate (e.g. Paracetamol 500mg, 12% GST).
2. **First Stock Inward (New Batch):**
   - Admin receives stock via `POST /api/v1/stock/inward`:
     - `batchNumber: 'BATCH-2026-A'`, `expiryDate: '2027-06-30'`, `mrp: '100.00'`, `sellingPrice: '80.00'`, `quantity: 50`.
     - Verify response indicates `batchCreated: true`.
     - Verify `batches.quantity_on_hand` equals 50.
     - Verify `stock_ledger_entries` contains one row with `delta: 50`, `balance_after: 50`, `type: 'INWARD'`.
3. **Second Stock Inward (Batch Top-Up):**
   - Admin receives additional stock for the identical batch:
     - `batchNumber: 'BATCH-2026-A'`, `expiryDate: '2027-06-30'`, `mrp: '100.00'`, `quantity: 30`.
     - Verify response indicates `batchCreated: false`.
     - Verify `batches.quantity_on_hand` equals 80.
     - Verify `stock_ledger_entries` contains second row with `delta: 30`, `balance_after: 80`.
4. **Price Ceiling Enforcement:**
   - Attempt inward with `sellingPrice: '95.00'`, `mrp: '100.00'` on 12% GST medicine (`95 * 1.12 = 106.40 > 100.00`).
   - Assert rejected with 422 `PRICE_EXCEEDS_MRP`.
5. **Past Expiry Date Enforcement:**
   - Attempt inward with `expiryDate: '2024-01-01'`.
   - Assert rejected with 422 `EXPIRY_IN_PAST`.
6. **GTIN Mismatch Guard:**
   - Attempt inward with `gtin: '8901234567890'` linked to a different medicine.
   - Assert rejected with 422 `BATCH_MEDICINE_MISMATCH`.

### Task 2: Stock Adjustment & Audit Trail Verification
1. **Damage Adjustment:**
   - Admin calls `POST /api/v1/batches/:batchId/adjust` with `type: 'DAMAGE'`, `quantity: 5`, `reason: 'Packaging damaged in handling'`.
   - Verify `batches.quantity_on_hand` decreases from 80 to 75.
   - Verify ledger entry records `delta: -5`, `balance_after: 75`, `type: 'DAMAGE'`.
2. **Physical Count Correction:**
   - Admin calls `POST /api/v1/batches/:batchId/adjust` with `type: 'CORRECTION'`, `quantity: 2`, `reason: 'Physical count audit reconciliation'`.
   - Verify `batches.quantity_on_hand` increases from 75 to 77.
   - Verify ledger entry records `delta: 2`, `balance_after: 77`, `type: 'CORRECTION'`.
3. **Expiry Write-Off Guard:**
   - Call `POST /api/v1/batches/:batchId/adjust` with `type: 'EXPIRY_WRITEOFF'` on the active batch (expiry in 2027).
   - Assert rejected with 409 `INVALID_STATE_TRANSITION` ("Cannot perform expiry write-off on an unexpired batch").
4. **Negative Balance Guard:**
   - Call `POST /api/v1/batches/:batchId/adjust` with `type: 'DAMAGE'`, `quantity: 100` (exceeding balance of 77).
   - Assert rejected with 422 `INSUFFICIENT_STOCK`.
   - Verify batch quantity remains 77.

### Task 3: Workspace Test & Build Verification
1. Run `npm test` across all workspaces:
   - Verify all unit, integration, and component tests pass (expecting > 100 tests).
2. Run `npm run lint` across backend and frontend (0 errors).
3. Run `npm run sync-enums:check` to ensure 0 enum drift.
4. Run `npm run build` across backend (`tsc`) and frontend (`next build`).
5. Update `.planning/STATE.md` and `.planning/ROADMAP.md` recording Phase 4 completion.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] Complete inward lifecycle passes end-to-end.
- [ ] Concurrent batch top-up aggregates quantities without row duplication.
- [ ] Business rule validations (`EXPIRY_IN_PAST`, `PRICE_EXCEEDS_MRP`, `BATCH_MEDICINE_MISMATCH`) pass.
- [ ] Adjustments enforce mandatory reason and update batch balance and ledger rows atomically.
- [ ] Expiry write-off on unexpired batch is refused with 409 `INVALID_STATE_TRANSITION`.
- [ ] All tests pass cleanly (`npm test`).
- [ ] Workspace compiles and passes linting (`npm run lint`, `npm run build`).
- [ ] Phase 4 sign-off recorded in `.planning/STATE.md` and `.planning/ROADMAP.md`.
