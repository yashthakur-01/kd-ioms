# Plan 4-02: Stock Inward & Scan Resolution API

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-02`  
**Wave:** 2  
**Dependencies:** Plan `4-01`, Phase 3 (Medicines)  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the stock inward controller, service, validation schemas, and routes for receiving physical inventory (`POST /api/v1/stock/inward`) and pre-resolving barcode/OCR scan payloads (`POST /api/v1/stock/scan/resolve`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Validation Schemas (`backend/src/modules/stock-inward/stock-inward.validation.ts`)
1. Create `backend/src/modules/stock-inward/stock-inward.validation.ts`:
   - `inwardStockSchema`:
     - `body`:
       - `medicineId`: `z.number().int().positive()`
       - `batchNumber`: `z.string().trim().min(1).max(50)`
       - `expiryDate`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD')`
       - `mrp`: `z.string().regex(/^\d+(\.\d{1,2})?$/, 'MRP must be a valid positive money string with at most 2 decimals')`
       - `sellingPrice`: `z.string().regex(/^\d+(\.\d{1,2})?$/, 'Selling price must be a valid positive money string with at most 2 decimals')`
       - `purchaseRate`: `z.string().regex(/^\d+(\.\d{1,2})?$/, 'Purchase rate must be a valid money string').optional().default('0.00')`
       - `quantity`: `z.number().int().min(1).max(100000)`
       - `supplierName`: `z.string().trim().max(150).optional()`
       - `gtin`: `z.string().trim().regex(/^\d{8,14}$/, 'GTIN must be 8-14 digits').optional()`
       - `qrPayload`: `z.string().max(2000).optional()`
       - `captureMethod`: `z.enum(CAPTURE_METHOD_VALUES, { message: 'captureMethod must be SCAN_BARCODE, SCAN_OCR, or MANUAL' })`
     - `.strict()`
   - `scanResolveSchema`:
     - `body`:
       - `payload`: `z.string().min(1).max(2000)`
     - `.strict()`

### Task 2: Inward & Scan Service (`backend/src/modules/stock-inward/stock-inward.service.ts`)
1. Implement `resolveScan(payload: string)`:
   - Call `parseGs1(payload)` from `utils/gtin.ts`.
   - If `gtin` is extracted:
     - Search existing batches matching `gtin`: `SELECT DISTINCT m.* FROM medicines m JOIN batches b ON m.medicine_id = b.medicine_id WHERE b.gtin = $1`.
     - If matches found, include in `medicineSuggestions`.
   - Return `{ gtin: parsed.gtin, batchNumber: parsed.batchNumber, expiryDate: parsed.expiryDate, medicineSuggestions }`.
2. Implement `inwardStock(payload: InwardStockInput, user: AuthenticatedUser)`:
   - Run inside `withTransaction(async (client) => { ... })`:
     - **Lock Medicine:** `await lockMedicines(client, [payload.medicineId]);`
     - **Verify Medicine Exists & Active:**
       - Query `SELECT medicine_id, name, company, pack_size, gst_rate, is_active FROM medicines WHERE medicine_id = $1`.
       - If not found or `!is_active` -> throw `NotFoundError({ code: 'NOT_FOUND', message: 'Medicine not found or inactive' })`.
     - **Verify Expiry Date is in Future or Today:**
       - Compare `payload.expiryDate < todayIst()`.
       - If past -> throw `BusinessRuleError({ code: 'EXPIRY_IN_PAST', httpStatus: 422, message: 'Expiry date cannot be in the past' })`.
     - **Verify Selling Price incl. GST <= MRP:**
       - `sellingPricePaise = toPaise(payload.sellingPrice);`
       - `effectivePricePaise = addGst(sellingPricePaise, medicine.gstRate);`
       - `mrpPaise = toPaise(payload.mrp);`
       - If `effectivePricePaise > mrpPaise` -> throw `BusinessRuleError({ code: 'PRICE_EXCEEDS_MRP', httpStatus: 422, message: 'Selling price inclusive of GST cannot exceed MRP', details: { effectivePrice: fromPaise(effectivePricePaise), mrp: payload.mrp, gstRate: medicine.gstRate } })`.
     - **Verify GTIN Uniqueness per Medicine:**
       - If `payload.gtin`:
         - Query `SELECT medicine_id FROM batches WHERE gtin = $1 AND medicine_id != $2 LIMIT 1`, `[payload.gtin, payload.medicineId]`.
         - If found -> throw `BusinessRuleError({ code: 'BATCH_MEDICINE_MISMATCH', httpStatus: 422, message: 'GTIN is already associated with another medicine' })`.
     - **Find or Insert Batch:**
       - Query `SELECT * FROM batches WHERE medicine_id = $1 AND batch_number = $2 AND expiry_date = $3 AND mrp = $4 FOR UPDATE`, `[payload.medicineId, payload.batchNumber, payload.expiryDate, payload.mrp]`.
       - If exists:
         - `batch = existingRow;`
         - `batchCreated = false;`
       - If not exists:
         - Insert: `INSERT INTO batches (medicine_id, batch_number, expiry_date, mrp, selling_price, purchase_rate, quantity_on_hand, status, gtin, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', $7, $8, NOW(), NOW()) RETURNING *`, `[payload.medicineId, payload.batchNumber, payload.expiryDate, payload.mrp, payload.sellingPrice, payload.purchaseRate, payload.gtin || null, user.userId]`.
         - `batch = insertedRow;`
         - `batchCreated = true;`
     - **Apply Ledger Entry:**
       - Call `applyLedgerEntry(client, { batchId: batch.batch_id, type: 'INWARD', delta: payload.quantity, supplierName: payload.supplierName, userId: user.userId })`.
     - Query updated batch row: `SELECT * FROM batches WHERE batch_id = $1`.
     - Return `{ batch: updatedBatch, ledgerEntry: { entryId, balanceAfter }, batchCreated }`.

### Task 3: Controller & Routes (`backend/src/modules/stock-inward/`)
1. Create `stock-inward.controller.ts`:
   - `handleInwardStock`: calls `inwardStock`, returns 201 `created(res, result, 'Stock inward recorded successfully')`.
   - `handleResolveScan`: calls `resolveScan`, returns 200 `ok(res, result)`.
2. Create `stock-inward.route.ts`:
   - Router protected by `authenticate`, `authorize([USER_ROLE.ADMIN])`, `requirePasswordChanged`.
   - Mount:
     - `POST /inward` -> `validate(inwardStockSchema)`, `handleInwardStock`
     - `POST /scan/resolve` -> `validate(scanResolveSchema)`, `handleResolveScan`
   - Wire route into main API router at `/api/v1/stock`.

### Task 4: Integration Tests (`backend/src/modules/stock-inward/__tests__/stock-inward.integration.test.ts`)
1. Create integration tests:
   - Success: inward on new batch creates batch with `batchCreated: true` and writes `INWARD` ledger entry.
   - Success: concurrent/subsequent inward on identical `(medicine_id, batch_number, expiry_date, mrp)` tops up batch with `batchCreated: false` and accurate aggregate balance.
   - Rejection: past expiry date returns 422 `EXPIRY_IN_PAST`.
   - Rejection: selling price + GST exceeding MRP returns 422 `PRICE_EXCEEDS_MRP`.
   - Rejection: GTIN linked to another medicine returns 422 `BATCH_MEDICINE_MISMATCH`.
   - Rejection: non-existent medicine returns 404 `NOT_FOUND`.
   - Role protection: Retailer role attempting inward receives 403 `FORBIDDEN`.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] `POST /api/v1/stock/inward` processes inward stock, creating or topping up batches atomically.
- [ ] Ledger entry records exact delta, balance after, supplier name, and admin user attribution.
- [ ] Concurrency test proves two parallel inward calls for identical batch aggregate without collision.
- [ ] Business rule validations (`EXPIRY_IN_PAST`, `PRICE_EXCEEDS_MRP`, `BATCH_MEDICINE_MISMATCH`) pass.
- [ ] `POST /api/v1/stock/scan/resolve` pre-resolves GS1 payloads into structured suggestions.
- [ ] Integration tests pass cleanly (`npm test`).
