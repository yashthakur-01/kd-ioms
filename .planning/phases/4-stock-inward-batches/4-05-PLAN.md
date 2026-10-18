# Plan 4-05: Frontend Stock Inward, Batch Directory & Adjustment UI

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-05`  
**Wave:** 5  
**Dependencies:** Plan `4-02`, Plan `4-03`, Plan `4-04`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the frontend UI for physical stock receiving (`/stock/inward` with `ScanConfirmForm`), the batches directory (`/batches` with near-expiry color badges), batch ledger detail view (`/batches/:batchId`), stock adjustment modal (`BatchAdjustModal`), and the global stock ledger audit explorer (`/stock/ledger`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Features Data Layer (`frontend/src/features/stock/` & `frontend/src/features/batches/`)
1. Create `frontend/src/features/stock/`:
   - `api.ts`: `inwardStock(payload)`, `resolveScan(payload)`.
   - `hooks.ts`: `useInwardStock()`, `useResolveScan()`.
   - `schema.ts`: Zod validation schema for inward stock form.
2. Create `frontend/src/features/batches/`:
   - `api.ts`: `listBatches(params)`, `getBatchById(id)`, `updateBatch(id, payload)`, `adjustBatch(id, payload)`, `listLedger(params)`.
   - `keys.ts`: TanStack Query key factory (`batchesKeys`, `ledgerKeys`).
   - `hooks.ts`: `useBatches()`, `useBatch()`, `useUpdateBatch()`, `useAdjustBatch()`, `useStockLedger()`.
   - `schema.ts`: Zod schema for batch adjustment form.

### Task 2: Stock Inward Hub & Form (`frontend/src/app/(admin)/stock/inward/page.tsx`)
1. Create `/stock/inward` page:
   - Header with 3 capture modes:
     - "Camera / Scan Barcode": opens `CameraScannerModal` or hardware scanner listener.
     - "Packaging Photo OCR": opens photo upload / text paste parser.
     - "Manual Inward": opens blank form directly.
   - Interactive `ScanConfirmForm`:
     - Medicine Selector: uses `MedicineSearch` / typeahead selector from Phase 3.
     - Batch Number: text input.
     - Expiry Date: date picker (restricted to today or future).
     - MRP & Selling Price: inputs with live calculated "Price Incl. GST" preview and warning/block if `priceInclGst > mrp`.
     - Quantity: integer input.
     - Purchase Rate & Supplier Name: optional inputs.
     - GTIN & Capture Method indicator badge (`SCAN_BARCODE`, `SCAN_OCR`, `MANUAL`).
     - Submit button with loading state.
   - On success:
     - Success banner / card showing batch summary, whether it was newly created or topped up, and ledger movement reference.
     - Quick "Receive Another Batch" button.

### Task 3: Batches Directory & Adjustment Modal (`frontend/src/app/(admin)/batches/page.tsx`)
1. Create `/batches` page:
   - Filter toolbar:
     - Search input (`q` for batch number or medicine name).
     - Expiry tab selector: "All Batches", "Near Expiry (<=90d)", "Expired".
     - In-Stock toggle ("In Stock Only" / "All").
     - Status filter ("Active", "Blocked").
   - Table:
     - Medicine Name & Pack Size.
     - Batch Number.
     - Expiry Date with Days Left badge:
       - Green (> 90 days).
       - Amber warning (0 to 90 days: "Expires in X days").
       - Red danger (< 0 days: "Expired").
     - MRP & Selling Price (incl. GST).
     - Quantity on Hand.
     - Status Badge (`ACTIVE` / `BLOCKED`) with quick toggle.
     - Action buttons: "View Timeline" (links to `/batches/:id`), "Adjust Stock" (opens `BatchAdjustModal`).
2. Create `BatchAdjustModal`:
   - Opens for a selected batch.
   - Adjustment Type dropdown: `DAMAGE`, `CORRECTION`, `EXPIRY_WRITEOFF`.
   - Quantity input (positive/negative based on type; for damage and write-off, displays reduction).
   - Validation note: if selecting `EXPIRY_WRITEOFF` on unexpired batch, disables option with helper text.
   - Mandatory Reason input (5–300 chars).
   - Submits mutation, invalidates query cache, shows success toast.

### Task 4: Batch Detail Timeline & Global Ledger (`/batches/[batchId]/page.tsx` & `/stock/ledger/page.tsx`)
1. Create `/batches/[batchId]` page:
   - Batch summary cards (Medicine, Manufacturer, Expiry Date, MRP, Current Balance, Status).
   - Audit trail table showing last 20 movements:
     - Date & Time (IST).
     - Movement Type badge (`INWARD`, `OUTWARD`, `DAMAGE`, `CORRECTION`, `EXPIRY_WRITEOFF`, `RESTOCK`, `RETURN_IN`).
     - Delta (+/- quantity).
     - Balance After.
     - User Attribution & Supplier / Order Reference.
     - Reason / Notes.
2. Create `/stock/ledger` page:
   - Master inventory audit view with date range filter (`from`, `to`), movement type filter, and pagination.

### Task 5: Component Tests (`frontend/src/features/stock/__tests__/` & `batches/__tests__/`)
1. Inward form tests:
   - Renders fields, calculates GST price dynamically, displays MRP ceiling error when price exceeds MRP.
   - Submits valid inward payload.
2. Batches table tests:
   - Renders batch list with near-expiry badges.
   - Opens adjustment modal on action click.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] `/stock/inward` allows receiving stock via scan, photo OCR, or manual entry.
- [ ] `ScanConfirmForm` dynamically computes price incl. GST and blocks submission above MRP.
- [ ] `/batches` lists batches with 90-day near-expiry color coding and status toggling.
- [ ] `BatchAdjustModal` applies adjustments with mandatory reason field.
- [ ] `/batches/:batchId` displays detailed movement timeline and ledger audit trail.
- [ ] Frontend tests pass cleanly (`npm test`).
