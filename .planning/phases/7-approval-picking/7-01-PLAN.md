# Plan 7-01: FEFO Suggestion Engine & Allocation Service

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-01`  
**Wave:** 1 (FEFO Core Engine)  
**Dependencies:** Phase 0, Phase 4, Phase 6  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the FEFO (First Expiring, First Out) batch suggestion service (`allocation.service.ts`) and endpoint `GET /api/v1/orders/:orderId/pick-suggestions`. For each order line in a `PLACED` order, the service queries eligible active, unexpired batches (`expiry_date >= today_ist()`, `quantity_on_hand > 0`, `status = 'ACTIVE'`) sorted by `expiry_date ASC, batch_id ASC`. It flags whether each batch satisfies the line's quoted price ceiling (`withinQuote`) and computes greedy `suggestedQty` allocations to assist pickers.

---

## 2. Tasks & Detailed Instructions

### Task 1: Allocation Module Types & Service (`backend/src/modules/allocation/allocation.service.ts`)
- Create `backend/src/modules/allocation/allocation.types.ts`:
  ```ts
  export interface BatchPickSuggestion {
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    mrp: string;
    sellingPrice: string;
    gstRate: string;
    priceInclGst: string;
    quantityOnHand: number;
    withinQuote: boolean;
    suggestedQty: number;
  }

  export interface ItemPickSuggestion {
    orderItemId: number;
    medicineId: number;
    medicineName: string;
    company: string;
    packSize: string;
    requestedQuantity: number;
    quotedPriceInclGst: string;
    suggestions: BatchPickSuggestion[];
  }

  export interface OrderPickSuggestionsResult {
    orderId: number;
    orderNumber: string;
    items: ItemPickSuggestion[];
  }
  ```

- Create `backend/src/modules/allocation/allocation.service.ts`:
  ```ts
  export class AllocationService {
    /**
     * Generates FEFO suggestions for all lines of a PLACED order.
     */
    async suggest(orderId: number): Promise<OrderPickSuggestionsResult> {
      // 1. Fetch order and verify status is PLACED
      // 2. Fetch order_items for orderId with medicine details
      // 3. For each medicineId, query active unexpired batches:
      //    SELECT b.batch_id, b.batch_number, b.expiry_date, b.mrp, b.selling_price,
      //           m.gst_rate, b.quantity_on_hand,
      //           ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
      //    FROM batches b
      //    JOIN medicines m ON b.medicine_id = m.medicine_id
      //    WHERE b.medicine_id = $1 AND b.status = 'ACTIVE'
      //      AND b.expiry_date >= today_ist() AND b.quantity_on_hand > 0
      //    ORDER BY b.expiry_date ASC, b.batch_id ASC
      // 4. Calculate withinQuote = (price_incl_gst <= line.quoted_price_incl_gst)
      // 5. Greedily calculate suggestedQty across batches where withinQuote === true until requested_quantity is reached
    }
  }
  ```

### Task 2: Controller & Route (`allocation.controller.ts`, `allocation.route.ts`)
- Create `backend/src/modules/allocation/allocation.controller.ts`:
  - `getPickSuggestions`: extracts `orderId` from params, verifies order exists and is `PLACED`, delegates to `allocationService.suggest(orderId)`, returns standard envelope `200 PICK_SUGGESTIONS_RETRIEVED`.
- Create `backend/src/modules/allocation/allocation.route.ts`:
  - Route `GET /orders/:orderId/pick-suggestions` protected by `authenticate`, `authorize([USER_ROLE.ADMIN])`.
- Mount in `backend/src/routes/index.ts`.

### Task 3: Unit Tests (`backend/src/modules/allocation/__tests__/allocation.suggest.test.ts`)
- Test cases:
  1. Orders in status other than `PLACED` throw 409 `INVALID_STATE_TRANSITION`.
  2. Batches are sorted strictly by earliest expiry date first (`expiry_date ASC`).
  3. Batches with selling price incl. GST exceeding quoted ceiling are marked `withinQuote: false` and skipped for `suggestedQty`.
  4. Greedy algorithm fills requested quantity across multiple batches correctly when the earliest batch has insufficient on-hand quantity.
  5. If available stock is less than requested, `suggestedQty` across all batches totals to available stock (partial suggestion).

---

## 3. Verification Criteria

- [ ] `GET /api/v1/orders/:orderId/pick-suggestions` returns 200 with FEFO-ordered batches.
- [ ] Non-placed orders return 409 `INVALID_STATE_TRANSITION`.
- [ ] Unit tests pass cleanly via `npm test -- backend/src/modules/allocation/__tests__/allocation.suggest.test.ts`.
