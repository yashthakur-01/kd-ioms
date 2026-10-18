# Plan 4-01: Stock Ledger Service & GS1 Utilities

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-01`  
**Wave:** 1  
**Dependencies:** Phase 0 (Database, AppError), Phase 1 (Auth), Phase 3 (Medicines)  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the platform's core inventory integrity primitive (`applyLedgerEntry`) in `stock-ledger.service.ts` and the GS1 Application Identifier barcode parser in `utils/gtin.ts` with comprehensive unit tests.

---

## 2. Tasks & Detailed Instructions

### Task 1: GS1 Application Identifier Parser (`backend/src/utils/gtin.ts`)
1. Create `backend/src/utils/gtin.ts`:
   - Implement `parseGs1(payload: string): { gtin?: string; batchNumber?: string; expiryDate?: string; serial?: string }`:
     - Clean payload (strip leading `]d2` or `]C1` Symbology Identifiers if present).
     - Handle FNC1 ASCII delimiter `\x1d` (ASCII 29) or standard AI parenthesis formatting `(01)...(10)...(17)...`.
     - Parse AI `(01)` or `01`: 14-digit GTIN.
     - Parse AI `(10)` or `10`: Batch/Lot number (variable alphanumeric up to 20 chars, ending at FNC1 or end of string).
     - Parse AI `(17)` or `17`: Expiry date in `YYMMDD` format:
       - If day `DD` is `00`, compute the last day of month `MM`.
       - Year `YY`: if `YY >= 50`, `19YY`; if `YY < 50`, `20YY` (or standard pharma century mapping).
       - Output formatted as `YYYY-MM-DD`.
     - Parse AI `(21)` or `21`: Serial number (optional, variable up to 20 chars).
     - If string is a plain 8, 12, 13, or 14-digit barcode without AIs, treat as raw GTIN.
2. Unit tests in `backend/src/utils/__tests__/gtin.test.ts`:
   - Valid GS1 DataMatrix string with AI 01, 10, 17.
   - GS1 payload with FNC1 (`\x1d`) variable-length delimiters.
   - Day `00` month-end expiry normalization (e.g. `260200` -> `2026-02-28`).
   - Plain EAN-13 / GTIN-14 barcodes without GS1 AIs.
   - Malformed/unrecognized payload fallback (returns empty object gracefully).

### Task 2: Core Append-Only Stock Ledger (`backend/src/modules/stock-ledger/stock-ledger.service.ts`)
1. Create `backend/src/modules/stock-ledger/stock-ledger.service.ts`:
   - Define interface:
     ```ts
     export interface ApplyLedgerEntryParams {
       batchId: number;
       type: LedgerEntryType;
       delta: number;
       reason?: string;
       supplierName?: string;
       orderId?: number;
       orderItemId?: number;
       userId?: string;
     }
     ```
   - Implement `applyLedgerEntry(client: pg.PoolClient, params: ApplyLedgerEntryParams): Promise<{ entryId: number; balanceAfter: number }>`:
     - Delta validation:
       - Delta cannot be 0 (`VALIDATION_ERROR` 400).
       - If `type` in `['INWARD', 'RESTOCK', 'RETURN_IN']`: `delta` must be > 0.
       - If `type` in `['OUTWARD', 'DAMAGE', 'EXPIRY_WRITEOFF']`: `delta` must be < 0.
       - If `type === 'CORRECTION'`: `delta !== 0` (can be positive or negative).
     - Lock batch row:
       - Query `SELECT batch_id, quantity_on_hand, status, expiry_date FROM batches WHERE batch_id = $1 FOR UPDATE`, `[batchId]`.
       - If not found -> throw `NotFoundError({ code: 'NOT_FOUND', message: 'Batch not found' })`.
     - Calculate new balance:
       - `const currentQty = batch.quantity_on_hand;`
       - `const balanceAfter = currentQty + delta;`
       - If `balanceAfter < 0` -> throw `BusinessRuleError({ code: 'INSUFFICIENT_STOCK', httpStatus: 422, message: 'Stock balance cannot be negative', details: { batchId, currentQty, requestedDelta: delta } })`.
     - Update batch:
       - `UPDATE batches SET quantity_on_hand = $1, updated_at = NOW() WHERE batch_id = $2`, `[balanceAfter, batchId]`.
     - Insert ledger entry:
       - `INSERT INTO stock_ledger_entries (batch_id, type, delta, balance_after, reason, supplier_name, order_id, order_item_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING entry_id`, `[batchId, type, delta, balanceAfter, reason || null, supplierName || null, orderId || null, orderItemId || null, userId || null]`.
     - Return `{ entryId, balanceAfter }`.
2. Unit / Integration tests in `backend/src/modules/stock-ledger/__tests__/stock-ledger.test.ts`:
   - Successful `INWARD` increments balance and records ledger row.
   - Successful `OUTWARD` decrements balance and records ledger row.
   - Rejection when `type === 'INWARD'` with negative delta.
   - Rejection when `type === 'OUTWARD'` with positive delta.
   - Rejection when balance would drop below zero (`INSUFFICIENT_STOCK` 422).
   - Rejection on non-existent batch (`NOT_FOUND` 404).

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] `parseGs1` accurately extracts GTIN, batch number, and expiry date across formats.
- [ ] `applyLedgerEntry` acquires exclusive row lock on batch row.
- [ ] Delta signs strictly enforced per `LEDGER_ENTRY_TYPE`.
- [ ] Balances dropping below 0 roll back and throw 422 `INSUFFICIENT_STOCK`.
- [ ] Batch `quantity_on_hand` and `stock_ledger_entries.balance_after` stay 100% in sync.
- [ ] Unit and integration tests pass cleanly (`npm test`).
