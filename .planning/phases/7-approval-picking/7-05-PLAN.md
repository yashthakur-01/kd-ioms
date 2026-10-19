# Plan 7-05: Frontend Admin Order Picking Screen & Card UI

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-05`  
**Wave:** 5 (Frontend Picking Workflow & Components)  
**Dependencies:** Plan 7-01, Plan 7-03, Plan 7-04  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the frontend Admin Order Picking interface at `/orders/[orderId]/pick` (and accessible from the admin orders review queue). Implement card-based item picking (`OrderItemPickCard`), clickable FEFO suggestion chips (`FefoSuggestionChips`), batch allocation quantity steppers (`BatchAllocationRow`), fulfillment progress tracking, and rejection modal with reason presets (`OrderRejectModal`).

---

## 2. Tasks & Detailed Instructions

### Task 1: API Client Extensions & Picking Hook (`frontend/src/features/orders/hooks/useOrderPicking.ts`)
- In `frontend/src/lib/api/orders.api.ts`, add methods:
  - `getPickSuggestions(orderId: number)` -> `GET /api/v1/orders/${orderId}/pick-suggestions`
  - `approveOrder(orderId: number, picks: ApproveOrderPicks)` -> `POST /api/v1/orders/${orderId}/approve`
  - `rejectOrder(orderId: number, reason: string)` -> `POST /api/v1/orders/${orderId}/reject`
  - `resolveScan(payload: string, medicineId?: number)` -> `POST /api/v1/batches/resolve-scan`
- In `frontend/src/features/orders/hooks/useOrderPicking.ts`:
  - Fetch pick suggestions via `useQuery`.
  - Maintain client picking state: `Map<orderItemId, Array<{ batchId, batchNumber, expiryDate, quantity, maxOnHand, captureMethod }>>`.
  - Mutations for `approveOrder` and `rejectOrder` with query cache invalidation and toast notifications.

### Task 2: FEFO Suggestion Chips (`FefoSuggestionChips.tsx`)
- Create `frontend/src/features/orders/components/FefoSuggestionChips.tsx`:
  - Renders suggestion pills for a line item.
  - Displays: batch number, expiry date (with near-expiry color highlight), on-hand stock, and within-quote indicator.
  - Single-click action "Apply Suggested" automatically assigns the recommended `suggestedQty` to the line's pick state.

### Task 3: Chosen Batch Allocation Row (`BatchAllocationRow.tsx`)
- Create `frontend/src/features/orders/components/BatchAllocationRow.tsx`:
  - Renders an allocated batch row inside an item card:
    - Batch number, expiry date, capture method icon (Gun / Camera / Manual).
    - Quantity stepper clamped between 1 and `Math.min(batch.quantityOnHand, requestedRemaining)`.
    - Delete/Remove button to de-allocate the batch.

### Task 4: Order Item Pick Card (`OrderItemPickCard.tsx`)
- Create `frontend/src/features/orders/components/OrderItemPickCard.tsx`:
  - Header: Medicine name, company, pack size, requested quantity, quoted price incl. GST.
  - Progress badge:
    - Green `FULL` badge if `pickedQty === requestedQty`.
    - Amber `PARTIAL` badge if `0 < pickedQty < requestedQty`.
    - Slate `NONE` badge if `pickedQty === 0`.
  - Body:
    - FEFO suggestion chips.
    - Active allocations list.
    - Manual batch selection dropdown (allowing picker to choose any other active unexpired batch).
    - Scan Batch button (triggers camera modal or prepares line for hardware gun scan).

### Task 5: Order Rejection Modal (`OrderRejectModal.tsx`)
- Create `frontend/src/features/orders/components/OrderRejectModal.tsx`:
  - Quick-preset chips:
    - `"Stock damaged or expired on shelf"`
    - `"Customer requested order cancellation"`
    - `"Unfulfillable inventory shortage"`
    - `"Batch price quote discrepancy"`
  - Freeform textarea (validates 5–300 characters).
  - Submit action with loading spinner.

### Task 6: Admin Order Picking Page (`frontend/src/app/(admin)/orders/[orderId]/pick/page.tsx`)
- Create page displaying:
  - Header: Order number, Retailer details (Shop name, city, contact), current status (`PLACED`).
  - Fulfillment summary bar: Total items, Complete lines count, Partial lines count, Dropped shortfall summary.
  - Action bar: "Approve Order" (disabled if 0 items picked), "Reject Order" (opens `OrderRejectModal`).
  - List of `OrderItemPickCard` components.

### Task 7: Frontend Component Tests (`OrderItemPickCard.test.tsx`, `OrderRejectModal.test.tsx`)
- Unit tests validating:
  1. Card renders requested quantity and updates picked quantity dynamically as steppers change.
  2. Clicking FEFO suggestion chip populates batch and suggested quantity.
  3. Rejection modal validates minimum 5 character reason and submits successfully.

---

## 3. Verification Criteria

- [ ] `/orders/[orderId]/pick` renders all order lines with FEFO suggestion chips.
- [ ] Picking batches updates live fulfillment counts and badges (`FULL`, `PARTIAL`, `NONE`).
- [ ] Approve button triggers `POST /api/v1/orders/:orderId/approve` and redirects on success.
- [ ] Reject modal captures reason and triggers `POST /api/v1/orders/:orderId/reject`.
- [ ] Component tests pass cleanly via `npm test`.
