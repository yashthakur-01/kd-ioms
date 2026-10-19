# Phase 7 Context: Order Approval and Batch Picking

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Responsible Developer:** `dev1`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 7`)  
**Primary Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 12, Section 2.1, Section 2.8, Section 2.9, Section 9.2, and [`ROADMAP.md`](file:///d:/coding/Projects/kd-ioms/.planning/ROADMAP.md) Phase 7  

---

## 1. Phase Objective & Boundary

Implement the complete warehouse fulfillment workflow where an Admin inspects incoming `PLACED` orders, allocates and picks physical inventory batches using FEFO (First Expiring, First Out) heuristics or hardware/camera barcode scanning, and approves orders with atomic stock reduction via the append-only ledger (`OUTWARD`), or rejects orders with full stock restock (`RESTOCK`):

1. **FEFO Suggestion Engine (`GET /api/v1/orders/:orderId/pick-suggestions`):**
   - Retrieves active, unexpired batches (`expiry_date >= today_ist()`, `quantity_on_hand > 0`, `status = 'ACTIVE'`) sorted by earliest expiry date (`expiry_date ASC, batch_id ASC`).
   - Evaluates price ceiling constraint: `effectivePrice = ROUND(selling_price * (1 + gst_rate/100), 2) <= quotedPriceInclGst` (`withinQuote`).
   - Automatically computes recommended `suggestedQty` across eligible batches up to the order line's `requested_quantity`.
2. **Barcode Scan Resolver (`POST /api/v1/batches/resolve-scan`):**
   - Parses 1D/2D GS1 barcodes, GTINs, and OCR text payloads using `parseGs1`.
   - Resolves matching batch by GTIN or composite `(batch_number, expiry_date)`.
   - Optionally scopes lookup to a target `medicineId`.
   - Returns matched batch details or 404 `BATCH_NOT_FOUND`.
3. **Atomic Order Approval Engine (`POST /api/v1/orders/:orderId/approve`):**
   - Executed within a single database transaction (`withTransaction`).
   - Exclusively locks order (`FOR UPDATE`) and validates `status = 'PLACED'` (else 409 `INVALID_STATE_TRANSITION`).
   - Collects all referenced batch IDs, sorts them in ascending numeric order, and locks them: `lockBatches(client, sortedBatchIds)`.
   - Validates each allocation against business invariants:
     - `PICK_EXCEEDS_REQUESTED` (422) if total picked for a line > `requested_quantity`.
     - `PICK_EXCEEDS_ON_HAND` (422) if allocation quantity > `batches.quantity_on_hand`.
     - `BATCH_EXPIRED` (422) if batch `expiry_date < today_ist()`.
     - `BATCH_BLOCKED` (422) if batch `status != 'ACTIVE'`.
     - `BATCH_MEDICINE_MISMATCH` (422) if batch does not belong to line's `medicine_id`.
     - `PRICE_EXCEEDS_QUOTE` (422) if batch selling price incl. GST exceeds line's `quoted_price_incl_gst`.
     - `VALIDATION_ERROR` (400) if zero allocations exist across all lines (must use reject instead).
   - Inserts records into `order_allocations(order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method, scanned_payload)`.
   - Decrements batch inventory exclusively through `applyLedgerEntry(client, { batchId, type: 'OUTWARD', delta: -quantity, orderId, orderItemId, userId: adminId })`.
   - Updates `order_items`: sets `picked_quantity` and `fulfilment_status` (`FULL` if picked == requested, `PARTIAL` if 0 < picked < requested, `NONE` if picked == 0).
   - Transitions order `status = 'APPROVED'`, updates `order_status_history`. Shortfall quantities are permanently dropped without creating backorders.
4. **Administrative Rejection & Stock Restock (`POST /api/v1/orders/:orderId/reject`):**
   - Rejection requires mandatory 5–300 character reason.
   - If order is `PLACED`: Transitions order to `REJECTED`, releases reserved availability, records history.
   - If order is `APPROVED` and unclaimed (`delivery_partner_id IS NULL`): Locks order, fetches all previous allocations, applies `RESTOCK` (+quantity) ledger entries via `applyLedgerEntry` to restore batch stocks, and marks order `REJECTED`.
   - If order is already claimed by a delivery partner or delivered, rejects with 409 `INVALID_STATE_TRANSITION`.
5. **Admin Picking UI & Scanning Experience:**
   - Orders review queue at `/orders` filterable by `PLACED` status.
   - Dedicated Picking screen at `/orders/[orderId]/pick` featuring expandable item cards:
     - Clear progress headers: Requested quantity, Picked count, Fulfilment badge (`FULL`, `PARTIAL`, `NONE`).
     - FEFO suggestion chips showing batch number, expiry date, on-hand count, and one-click "Apply Suggested" action.
     - Live Barcode Scanning (Hardware USB/Bluetooth Gun listener via `useBarcodeScanner` + Camera Viewfinder modal via `CameraScannerModal`).
     - Scanned batches automatically increment picked count by 1 (or fill suggested) accompanied by an audio-visual chime/flash.
     - Interactive summary footer displaying complete vs partial fulfillment totals before confirming approval.
     - Rejection modal with quick-preset reason chips ("Stock damaged", "Customer requested cancellation", "Unfulfillable shortage").

---

## 2. Architecture Decisions & Invariants

| Decision ID | Area | Decision Summary | Source Reference |
| :---: | :--- | :--- | :--- |
| **ADR-027** | FEFO Auto-Suggestion | `allocationService.suggest` queries active, unexpired batches (`status = 'ACTIVE'`, `expiry_date >= today_ist()`, `quantity_on_hand > 0`) ordered by `expiry_date ASC, batch_id ASC`. Automatically allocates `suggestedQty` across batches where `effectivePrice <= quotedPriceInclGst` up to `requested_quantity`. | User Alignment / `tech.md` 12.2 |
| **ADR-028** | Ascending Batch Locking | To avoid database deadlocks during concurrent pick approvals, all batch IDs in `picks` are deduplicated, sorted ascending, and locked via `lockBatches(client, sortedBatchIds)` (`FOR UPDATE`). | `tech.md` 2.8, 12.3 |
| **ADR-029** | Single-Source Inventory Reduction | Batch quantity decrements occur EXCLUSIVELY via `applyLedgerEntry` with type `OUTWARD` (negative delta), recording `order_id` and `order_item_id` in `stock_ledger_entries`. Direct `UPDATE batches` is strictly prohibited. | `tech.md` 9.2, 12.3 |
| **ADR-030** | Drop-Shortfall Partial Fulfillment | If admin picks less than requested quantity, line item status is set to `PARTIAL` (or `NONE`), and unallocated quantity is dropped. No backorders or pending line splits are generated. If all lines have 0 picks, approve request is rejected with 400 `VALIDATION_ERROR`. | `tech.md` 12.1, 12.2 |
| **ADR-031** | Unclaimed Order Restock Invariant | Admin can reject an `APPROVED` order only if `delivery_partner_id IS NULL`. Rejection triggers `applyLedgerEntry` with `RESTOCK` (+quantity) per allocation, restoring original batch balances. | `tech.md` 12.2, 12.3 |
| **ADR-032** | Scan-to-Pick Interaction | Barcode scans match via `parseGs1` and `resolveScan`. Matching a batch automatically fills or increments its picked quantity by 1, with an audible audio tone and emerald visual highlight. | User Alignment |

---

## 3. Detailed API Specifications

### 3.1 `GET /api/v1/orders/:orderId/pick-suggestions`
- **Auth:** Requires JWT, Role: `ADMIN`.
- **Validation:** Order must exist and have `status = 'PLACED'`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "PICK_SUGGESTIONS_RETRIEVED",
    "message": "Pick suggestions generated successfully",
    "data": {
      "orderId": 142,
      "orderNumber": "ORD-000142",
      "items": [
        {
          "orderItemId": 401,
          "medicineId": 55,
          "medicineName": "Amoxicillin 500mg",
          "company": "Abbott",
          "packSize": "10 Capsules",
          "requestedQuantity": 15,
          "quotedPriceInclGst": "120.00",
          "suggestions": [
            {
              "batchId": 89,
              "batchNumber": "AMX-2026-A",
              "expiryDate": "2026-11-30",
              "mrp": "135.00",
              "sellingPrice": "100.00",
              "gstRate": "12.00",
              "priceInclGst": "112.00",
              "quantityOnHand": 10,
              "withinQuote": true,
              "suggestedQty": 10
            },
            {
              "batchId": 92,
              "batchNumber": "AMX-2027-B",
              "expiryDate": "2027-04-30",
              "mrp": "140.00",
              "sellingPrice": "105.00",
              "gstRate": "12.00",
              "priceInclGst": "117.60",
              "quantityOnHand": 25,
              "withinQuote": true,
              "suggestedQty": 5
            }
          ]
        }
      ]
    },
    "meta": { "requestId": "req_...", "timestamp": "2026-10-20T..." }
  }
  ```

### 3.2 `POST /api/v1/batches/resolve-scan`
- **Auth:** Requires JWT, Role: `ADMIN`.
- **Body Schema:**
  ```ts
  {
    payload: string; // 1-2000 chars, GS1 barcode string or batch identifier
    medicineId?: number; // Optional filter scope
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "BATCH_RESOLVED",
    "message": "Batch resolved successfully",
    "data": {
      "batchId": 89,
      "medicineId": 55,
      "medicineName": "Amoxicillin 500mg",
      "batchNumber": "AMX-2026-A",
      "expiryDate": "2026-11-30",
      "mrp": "135.00",
      "sellingPrice": "100.00",
      "gstRate": "12.00",
      "priceInclGst": "112.00",
      "quantityOnHand": 10
    }
  }
  ```
- **Errors:** 404 `BATCH_NOT_FOUND` if no active unexpired batch matches payload.

### 3.3 `POST /api/v1/orders/:orderId/approve`
- **Auth:** Requires JWT, Role: `ADMIN`.
- **Body Schema:**
  ```ts
  {
    picks: Array<{
      orderItemId: number;
      allocations: Array<{
        batchId: number;
        quantity: number; // integer 1-5000
        captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL';
        scannedPayload?: string;
      }>;
    }>;
  }
  ```
- **Business Rule Validations:**
  - Order must be `PLACED` (else 409 `INVALID_STATE_TRANSITION`).
  - At least one allocation must have `quantity > 0` across the entire order (else 400 `VALIDATION_ERROR`).
  - Total allocated quantity for an `orderItemId` must not exceed `requested_quantity` (else 422 `PICK_EXCEEDS_REQUESTED`).
  - Allocated quantity must not exceed `batch.quantity_on_hand` (else 422 `PICK_EXCEEDS_ON_HAND`).
  - Batch must be `ACTIVE` (else 422 `BATCH_BLOCKED`).
  - Batch must not be expired: `expiry_date >= today_ist()` (else 422 `BATCH_EXPIRED`).
  - Batch `medicine_id` must match `order_item.medicine_id` (else 422 `BATCH_MEDICINE_MISMATCH`).
  - Batch `effective_price` (`ROUND(selling_price * (1 + gst_rate/100), 2)`) must not exceed `order_item.quoted_price_incl_gst` (else 422 `PRICE_EXCEEDS_QUOTE`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "ORDER_APPROVED",
    "message": "Order approved with batch allocations",
    "data": {
      "orderId": 142,
      "orderNumber": "ORD-000142",
      "status": "APPROVED",
      "items": [
        {
          "orderItemId": 401,
          "medicineId": 55,
          "requestedQuantity": 15,
          "pickedQuantity": 15,
          "fulfilmentStatus": "FULL",
          "allocations": [
            { "allocationId": 12, "batchId": 89, "batchNumber": "AMX-2026-A", "quantity": 10 },
            { "allocationId": 13, "batchId": 92, "batchNumber": "AMX-2027-B", "quantity": 5 }
          ]
        }
      ]
    }
  }
  ```

### 3.4 `POST /api/v1/orders/:orderId/reject`
- **Auth:** Requires JWT, Role: `ADMIN`.
- **Body Schema:**
  ```ts
  {
    reason: string; // 5-300 characters
  }
  ```
- **Transitions:**
  - If `status == 'PLACED'`: Transitions to `REJECTED`, releases reservation.
  - If `status == 'APPROVED'` and `delivery_partner_id IS NULL`: Restocks all allocated batches via `RESTOCK` ledger entries, sets order to `REJECTED`.
  - If `status == 'APPROVED'` and `delivery_partner_id IS NOT NULL`: 409 `INVALID_STATE_TRANSITION` (order already claimed by delivery partner).

---

## 4. Frontend Component Hierarchy & User Journey

```
src/app/(admin)/orders/
├── page.tsx                     // Admin orders queue (tabs: All, PLACED, APPROVED, OUT_FOR_DELIVERY)
└── [orderId]/
    ├── page.tsx                 // Order detail & picking view
    └── components/
        ├── OrderPickingHeader.tsx    // Order info, retailer summary, status badge, approval/reject action bar
        ├── OrderItemPickCard.tsx     // Card per line: requested vs picked badge, FEFO chips, scanner trigger
        ├── BatchAllocationRow.tsx    // Chosen batch row: batch number, expiry, editable qty stepper, remove button
        ├── FefoSuggestionChips.tsx   // Clickable chips to apply FEFO batches instantly
        ├── BarcodeScanListener.tsx   // Global hardware gun scanner handler
        ├── CameraScannerModal.tsx    // Camera modal with video stream and fallback dropzone
        └── OrderRejectModal.tsx      // Rejection dialog with reason presets & freeform text
```

---

## 5. Verification & Test Plan

1. **Unit & Helper Tests:**
   - FEFO sorting and suggested quantity calculation across multi-batch stock.
   - Price cap validation rejecting batches where `priceInclGst > quotedPriceInclGst`.
   - GS1 payload extraction in `resolveScan` matching GTIN, batch number, and expiry.
2. **Integration Tests (`order.approval.integration.test.ts`):**
   - Approve order with single batch full fulfillment -> verify `order_allocations`, `stock_ledger_entries` (OUTWARD), and balance update.
   - Approve order with multi-batch fulfillment -> verify ascending row lock and multiple ledger rows.
   - Partial fulfillment -> verify line set to `PARTIAL`, picked quantity recorded, remainder dropped.
   - Reject `PLACED` order -> verify state changed to `REJECTED`, zero ledger rows.
   - Reject unclaimed `APPROVED` order -> verify `RESTOCK` ledger rows, balance restored to original on-hand.
   - Attempt pick from expired batch -> 422 `BATCH_EXPIRED`.
   - Attempt pick from blocked/inactive batch -> 422 `BATCH_BLOCKED`.
   - Attempt pick exceeding quoted price -> 422 `PRICE_EXCEEDS_QUOTE`.
   - Concurrent approvals on same order -> first succeeds (200), second fails with 409 `INVALID_STATE_TRANSITION`.
3. **Frontend Component Tests:**
   - Item card renders FEFO suggestion chips and applies suggested quantities on click.
   - Barcode scan resolves batch and updates picked quantity.
   - Quantity inputs validate bounds (1 to requested quantity).
   - Reject modal validates 5–300 character reason and submits successfully.
