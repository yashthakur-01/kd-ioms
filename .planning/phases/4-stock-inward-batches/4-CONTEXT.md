# Phase 4 Context: Stock Inward, Batches and Append-Only Ledger

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Responsible Developer:** `dev1`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 4`)  
**Primary Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 9, Section 2.8, Section 2.9, and [`ROADMAP.md`](file:///d:/coding/Projects/kd-ioms/.planning/ROADMAP.md) Phase 4  

---

## 1. Phase Objective & Boundary

Establish the core physical inventory inward, batch lifecycle management, and immutable stock ledger:
1. **Append-Only Stock Ledger (`applyLedgerEntry`):**
   - Implement the platform's single authorized entry point in `stock-ledger.service.ts` for modifying `batches.quantity_on_hand`.
   - Atomic balance updates and immutable logging in `stock_ledger_entries`.
   - Strict validation of entry type delta signs (`INWARD`, `RESTOCK`, `RETURN_IN` positive; `OUTWARD`, `DAMAGE`, `EXPIRY_WRITEOFF` negative; `CORRECTION` non-zero).
   - Throws 422 `INSUFFICIENT_STOCK` if `balance_after` would drop below zero.
2. **Stock Inward Engine (`POST /api/v1/stock/inward`):**
   - Admin receives stock through barcode scan, packaging OCR, or manual entry.
   - Batch identity matching on `(medicine_id, batch_number, expiry_date, mrp)`: tops up existing batch or creates a new batch row.
   - Strict Indian pharmaceutical business validations:
     - Expiry date must be on or after today in IST (`EXPIRY_IN_PAST` 422).
     - Selling price incl. GST (`sellingPrice * (1 + gstRate / 100)`) must not exceed MRP (`PRICE_EXCEEDS_MRP` 422).
     - GTIN uniqueness check: if GTIN already belongs to another medicine, reject with 422 `BATCH_MEDICINE_MISMATCH`.
3. **GS1 Barcode & Packaging OCR Parsers:**
   - GS1 1D/2D parser (`backend/src/utils/gtin.ts`): decodes Application Identifiers AI(01) GTIN-14, AI(10) Batch, AI(17) Expiry Date (YYMMDD), AI(21) Serial with FNC1 delimiter support.
   - Packaging text heuristics parser (`frontend/src/lib/scan/parse-pack-text.ts`): regex extraction of candidate batch numbers, expiry dates (`MM/YY`, `MM/YYYY`, `DD-MM-YYYY`), and MRP values. Suggestion-only contract; never auto-saves.
   - Scan resolve endpoint (`POST /api/v1/stock/scan/resolve`) prefilling the inward confirmation form.
4. **Batch Lifecycle & Stock Adjustment Workflows:**
   - Batch directory with filtering (`GET /api/v1/batches`): status (`ACTIVE`, `BLOCKED`), expiry state (`ALL`, `NEAR`, `EXPIRED` with 90-day threshold), and stock availability.
   - Batch detail and ledger audit log (`GET /api/v1/batches/:batchId`).
   - Batch pricing and status updates (`PATCH /api/v1/batches/:batchId`).
   - Stock adjustments (`POST /api/v1/batches/:batchId/adjust`): `DAMAGE`, `CORRECTION`, and `EXPIRY_WRITEOFF` (requires batch expiry date in past; throws 409 `INVALID_STATE_TRANSITION` if not yet expired) with mandatory reason (5–300 chars).
   - Global stock ledger audit view (`GET /api/v1/stock/ledger`).
5. **Frontend Stock & Batch Management UI:**
   - `/stock/inward`: Hybrid scanner (keystroke listener for USB/Bluetooth hardware scanners, live camera stream for mobile/webcams, and image file upload fallback), plus interactive `ScanConfirmForm`.
   - `/batches`: Responsive table with near-expiry color-coded badges, status toggles, and adjustment dialog.
   - `/batches/:batchId`: Detailed batch timeline showing full ledger history.
   - `/stock/ledger`: Filterable inventory audit log.

---

## 2. Locked Implementation Decisions

### 2.1 Database & Concurrency Architecture
1. **Single Entry Point for Stock Changes:**
   - `applyLedgerEntry(client, { batchId, type, delta, reason?, supplierName?, orderId?, orderItemId?, userId })` is the **only** function that may modify `batches.quantity_on_hand`.
   - Direct SQL `UPDATE batches SET quantity_on_hand = ...` outside this service is forbidden.
   - Always takes an open PostgreSQL client/transaction (`client: pg.PoolClient`) and acquires an exclusive row lock on the batch via `lockBatches(client, [batchId])`.
2. **Balance & Sign Invariants:**
   - Sign enforcement based on `LEDGER_ENTRY_TYPE`:
     - Positive delta required (> 0): `INWARD`, `RESTOCK`, `RETURN_IN`
     - Negative delta required (< 0): `OUTWARD`, `DAMAGE`, `EXPIRY_WRITEOFF`
     - Non-zero delta required (!= 0): `CORRECTION`
   - Balance check: `const balanceAfter = currentQuantity + delta`. If `balanceAfter < 0`, rolls back and throws `BusinessRuleError({ code: 'INSUFFICIENT_STOCK', httpStatus: 422, message: 'Stock balance cannot be negative' })`.
   - Writes row to `stock_ledger_entries` recording `batch_id`, `type`, `delta`, `balance_after`, `reason`, `supplier_name`, `order_id`, `order_item_id`, `created_by`, `created_at`.
3. **Deadlock Prevention:**
   - Uses `lockMedicines(client, [medicineId])` and `lockBatches(client, [batchId])` to acquire locks in ascending primary-key order.

### 2.2 Inward Processing & Batch Matching
1. **Batch Identity Definition:**
   - A batch is uniquely identified by `(medicine_id, batch_number, expiry_date, mrp)` as enforced by `CONSTRAINT batches_identity_unique`.
2. **Top-Up vs New Batch Behavior:**
   - When receiving inward stock:
     - If a batch matching `(medicine_id, batch_number, expiry_date, mrp)` exists:
       - Top up the existing batch (`applyLedgerEntry(INWARD)`).
       - Keep the existing `selling_price` and `purchase_rate` intact on the batch record. (Supplier name and inward metadata are captured in the ledger row; admin can update batch selling price via `PATCH /batches/:id` if necessary).
       - Response returns `{ batch, ledgerEntry, batchCreated: false }`.
     - If no matching batch exists:
       - Create new batch row with `quantity_on_hand: 0`, `status: 'ACTIVE'`, `selling_price`, `purchase_rate`, and `gtin`.
       - Call `applyLedgerEntry(INWARD)`.
       - Response returns `{ batch, ledgerEntry, batchCreated: true }`.
3. **Pricing & Tax Calculations:**
   - All monetary calculations are performed in integer paise using `utils/money.ts`.
   - `effectivePricePaise = addGst(toPaise(sellingPrice), medicine.gstRate)`.
   - `mrpPaise = toPaise(mrp)`.
   - If `effectivePricePaise > mrpPaise`, reject with 422 `PRICE_EXCEEDS_MRP`.
4. **GTIN Validation:**
   - If `gtin` is provided, verify whether it is already registered in `batches` for a **different** `medicine_id`.
   - If a mismatch is detected, reject with 422 `BATCH_MEDICINE_MISMATCH`.

### 2.3 Barcode & Packaging OCR Heuristics
1. **Hybrid Barcode Scanner:**
   - Global keystroke listener in the browser detects hardware USB/Bluetooth barcode guns (rapid input buffer > 8 chars ending with `Enter`).
   - HTML5 Camera modal with video stream for phone back cameras / webcams (using `html5-qrcode` or modern Canvas/BarcodeDetector APIs).
   - Standard photo upload / file drop fallback.
2. **GS1 Parser (`backend/src/utils/gtin.ts`):**
   - Decodes GS1 formatted strings containing Application Identifiers:
     - `(01)`: 14-digit GTIN
     - `(10)`: Batch / Lot number (variable length up to 20 chars, terminated by FNC1 `\x1d` or end of string)
     - `(17)`: Expiry Date in `YYMMDD` format (converted to `YYYY-MM-DD`, with day 00 normalized to last day of month)
     - `(21)`: Serial number (optional)
3. **Packaging Text OCR Heuristics (`frontend/src/lib/scan/parse-pack-text.ts`):**
   - Regex extractors for noisy packaging text:
     - Batch: patterns like `B\.?No\.?[:\s]*([A-Z0-9-]+)`, `Batch[:\s]*([A-Z0-9-]+)`, `Lot[:\s]*([A-Z0-9-]+)`
     - Expiry: `(?:EXP|Expiry|Exp\.?\s*Date)[:\s]*(\d{1,2})[/.-](\d{2,4})`, `(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})`
     - MRP: `(?:M\.?R\.?P\.?|Rs\.?|₹)[:\s]*([0-9]+(?:\.[0-9]{1,2})?)`
   - Returns candidate suggestions for `batchNumber`, `expiryDate`, and `mrp` to prefill the confirmation form.

### 2.4 Batch Management & Near-Expiry Rules
1. **Near Expiry Threshold:**
   - Set to **90 days** (standard 3-month threshold in Indian retail pharma).
   - Calculated as: `daysLeft = differenceInCalendarDays(batch.expiryDate, todayIst())`.
   - Classification:
     - `EXPIRED`: `daysLeft < 0` (or `expiry_date < today_ist()`)
     - `NEAR`: `0 <= daysLeft <= 90`
     - `OK`: `daysLeft > 90`
2. **Expiry Write-Off Rules:**
   - When calling `POST /api/v1/batches/:batchId/adjust` with `type: 'EXPIRY_WRITEOFF'`:
   - System checks `batch.expiry_date < todayIst()`.
   - If batch has NOT expired, operation is rejected with 409 `INVALID_STATE_TRANSITION` ("Cannot perform expiry write-off on an active, non-expired batch").
3. **Reason Requirement:**
   - All manual adjustments (`DAMAGE`, `CORRECTION`, `EXPIRY_WRITEOFF`) require a descriptive reason of 5 to 300 characters.

---

## 3. API Contract Matrix

| Endpoint | Method | Role | Request Body / Query | Success Response | Error Codes |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/api/v1/stock/inward` | `POST` | `ADMIN` | `{ medicineId, batchNumber, expiryDate, mrp, sellingPrice, purchaseRate?, quantity, supplierName?, gtin?, qrPayload?, captureMethod }` | `201` `{ batch, ledgerEntry, batchCreated: boolean }` | `NOT_FOUND` (404), `EXPIRY_IN_PAST` (422), `PRICE_EXCEEDS_MRP` (422), `BATCH_MEDICINE_MISMATCH` (422), `VALIDATION_ERROR` (400) |
| `/api/v1/stock/scan/resolve` | `POST` | `ADMIN` | `{ payload: string }` | `200` `{ gtin?, batchNumber?, expiryDate?, medicineSuggestions[] }` | `VALIDATION_ERROR` (400) |
| `/api/v1/batches` | `GET` | `ADMIN` | `?medicineId&status&expiry=ALL,NEAR,EXPIRED&inStock&q&page&pageSize&sort` | `200` `{ rows: BatchListItem[], meta: { pagination } }` | `VALIDATION_ERROR` (400) |
| `/api/v1/batches/:batchId` | `GET` | `ADMIN` | Params: `batchId` | `200` `{ batch: BatchDetail, ledgerEntries: StockLedgerEntry[] }` | `NOT_FOUND` (404), `VALIDATION_ERROR` (400) |
| `/api/v1/batches/:batchId` | `PATCH` | `ADMIN` | Params: `batchId`<br/>Body: `{ sellingPrice?: string, status?: 'ACTIVE' | 'BLOCKED' }` | `200` `{ batch }` | `NOT_FOUND` (404), `PRICE_EXCEEDS_MRP` (422), `VALIDATION_ERROR` (400) |
| `/api/v1/batches/:batchId/adjust` | `POST` | `ADMIN` | Params: `batchId`<br/>Body: `{ type, quantity, reason }` | `200` `{ batch, ledgerEntry }` | `NOT_FOUND` (404), `INSUFFICIENT_STOCK` (422), `INVALID_STATE_TRANSITION` (409), `VALIDATION_ERROR` (400) |
| `/api/v1/stock/ledger` | `GET` | `ADMIN` | `?batchId&medicineId&type&from&to&page&pageSize` | `200` `{ rows: StockLedgerEntry[], meta: { pagination } }` | `VALIDATION_ERROR` (400) |

---

## 4. Frontend Route & Component Map

| Route / Component | Purpose | Key Behaviors |
| :--- | :--- | :--- |
| `/stock/inward` | Stock Inward Hub | Three capture modes: Barcode scan, Packaging OCR photo, Manual form. Prefills `ScanConfirmForm` via `/stock/scan/resolve`. |
| `ScanConfirmForm` | Inward Confirmation Form | Medicine typeahead with chips, live display of effective price incl. GST with MRP comparison badge, instant validation before submission. |
| `/batches` | Batch Directory | Searchable, paginated table with filter tabs (`All`, `Near Expiry (<=90d)`, `Expired`, `In Stock`), status toggle switch, and "Adjust" action button. |
| `/batches/:batchId` | Batch Ledger Audit View | Comprehensive batch overview with audit trail of last 20 movements, supplier information, and running balance graph/list. |
| `BatchAdjustModal` | Stock Adjustment Dialog | Modal with adjustment type selector (`Damage`, `Physical Count Correction`, `Expiry Write-off`), signed delta input, and 5–300 character reason text area. |
| `/stock/ledger` | Global Ledger Explorer | Master immutable inventory movements explorer with date range filtering, movement type filtering, and user attribution. |

---

## 5. Verification & Testing Strategy

1. **Unit Tests:**
   - GS1 Application Identifier parser (`utils/gtin.ts`): GTIN-14, variable-length batch, and expiry conversion.
   - Packaging OCR regex heuristic extractor (`parse-pack-text.ts`): multiple noisy Indian pharma package sample texts.
   - Ledger sign validation: delta must match allowed sign per entry type.
2. **Integration Tests (`backend/src/modules/stock-ledger/__tests__/` & `backend/src/modules/batch/__tests__/`):**
   - Concurrency: two parallel inward requests for the identical batch aggregate correctly; no duplicate rows created; balance equals the sum.
   - Business rules: past expiry date returns 422 `EXPIRY_IN_PAST`; selling price + GST exceeding MRP returns 422 `PRICE_EXCEEDS_MRP`.
   - GTIN conflict: GTIN linked to another medicine returns 422 `BATCH_MEDICINE_MISMATCH`.
   - Stock adjustments: writing damage/writeoff decrements balance; writeoff on unexpired batch returns 409 `INVALID_STATE_TRANSITION`; adjustment without valid reason is rejected.
   - Ledger balance: balance_after matches `batches.quantity_on_hand` at all times.
3. **Frontend Tests (`frontend/src/features/stock/__tests__/`):**
   - Inward form renders medicine picker, calculates effective GST price, and submits correctly.
   - Batch table renders status badges, near-expiry warning tags, and opens adjustment modal.
   - Quality checks: 0 lint errors, 0 enum drift, clean production build.
