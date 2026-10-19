# Plan 7-02: Barcode & Pack Scan Resolver Service

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-02`  
**Wave:** 2 (Barcode & Scan Layer)  
**Dependencies:** Phase 0, Phase 4  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the barcode and pack scan resolution endpoint `POST /api/v1/batches/resolve-scan` in `allocation.service.ts`. The resolver takes a raw barcode string or OCR payload (1D barcode, GS1 DataMatrix, or scanned pack text), extracts identifiers using `parseGs1`, and queries the database to find the matching active, unexpired batch with positive on-hand inventory.

---

## 2. Tasks & Detailed Instructions

### Task 1: Scan Resolver Method in `AllocationService`
- In `backend/src/modules/allocation/allocation.service.ts`:
  - Implement `resolveScan({ payload, medicineId }: { payload: string; medicineId?: number })`:
    ```ts
    export interface ResolveScanResult {
      batchId: number;
      medicineId: number;
      medicineName: string;
      batchNumber: string;
      expiryDate: string;
      mrp: string;
      sellingPrice: string;
      gstRate: string;
      priceInclGst: string;
      quantityOnHand: number;
    }
    ```
  - Use `parseGs1(payload)` from `../../utils/gtin.js`:
    1. If `parsed.gtin`:
       - Query batch by `b.gtin = $1` (and `b.medicine_id = $2` if `medicineId` supplied).
    2. If `parsed.batchNumber` and `parsed.expiryDate`:
       - Query batch by `LOWER(TRIM(b.batch_number)) = LOWER(TRIM($1))` and `b.expiry_date = $2`.
    3. Fallback raw text lookup:
       - Match `b.batch_number` against raw trimmed payload.
  - Require the matched batch to satisfy:
    - `b.status = 'ACTIVE'`
    - `b.expiry_date >= today_ist()`
    - `b.quantity_on_hand > 0`
  - If no eligible batch found, throw `NotFoundError` (`404 BATCH_NOT_FOUND`, message: `'No active unexpired batch found matching scan payload'`).

### Task 2: Controller & Route (`POST /api/v1/batches/resolve-scan`)
- In `backend/src/modules/allocation/allocation.controller.ts`:
  - Implement `resolveScan(req, res)`:
    - Validate body using Zod schema:
      ```ts
      export const resolveScanSchema = z.object({
        payload: z.string().min(1, 'Payload is required').max(2000),
        medicineId: z.coerce.number().int().positive().optional(),
      });
      ```
    - Delegate to `allocationService.resolveScan`.
    - Return standard envelope `200 BATCH_RESOLVED`.
- In `backend/src/modules/allocation/allocation.route.ts`:
  - Mount `POST /batches/resolve-scan` (or in `batch.route.ts`), protected by `authenticate` and `authorize([USER_ROLE.ADMIN])`.

### Task 3: Unit & Integration Tests (`allocation.scan.test.ts`)
- In `backend/src/modules/allocation/__tests__/allocation.scan.test.ts`:
  - Test GS1-128 barcode parsing with AI(01), AI(10), AI(17) matching stored batch.
  - Test GTIN-only matching across active batches.
  - Test scoping by `medicineId` (matches within medicine; rejects if batch belongs to another medicine).
  - Test expired batch yields 404 `BATCH_NOT_FOUND` (or inactive batch).
  - Test unparseable/unknown string yields 404 `BATCH_NOT_FOUND`.

---

## 3. Verification Criteria

- [ ] `POST /api/v1/batches/resolve-scan` returns matching batch details for valid GS1/GTIN payloads.
- [ ] Inactive, zero-inventory, or expired batches are filtered out and return 404 `BATCH_NOT_FOUND`.
- [ ] Automated tests pass cleanly via `npm test -- backend/src/modules/allocation/__tests__/allocation.scan.test.ts`.
