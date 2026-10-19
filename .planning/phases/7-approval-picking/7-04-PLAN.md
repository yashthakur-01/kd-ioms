# Plan 7-04: Admin Rejection, Unclaimed Restock & Integration Tests

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-04`  
**Wave:** 4 (Rejection, Restock & Full Backend Verification)  
**Dependencies:** Plan 7-01, Plan 7-02, Plan 7-03  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the administrative rejection endpoint `POST /api/v1/orders/:orderId/reject`. If the order is `PLACED`, rejection transitions status to `REJECTED` and releases reserved inventory. If the order was already `APPROVED` but remains unclaimed by a delivery partner (`delivery_partner_id IS NULL`), rejection automatically iterates through all picked allocations and triggers `applyLedgerEntry(RESTOCK)` to restore physical inventory back to the original batches. Build comprehensive integration tests validating approval, rejection, restock, deadlock safety, and constraint triggers.

---

## 2. Tasks & Detailed Instructions

### Task 1: Rejection Zod Schema & Route
- In `backend/src/modules/order/order.validation.ts`:
  ```ts
  export const rejectOrderSchema = z.object({
    reason: z.string().trim().min(5, 'Rejection reason must be at least 5 characters').max(300, 'Rejection reason cannot exceed 300 characters'),
  });

  export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
  ```

### Task 2: `orderService.rejectOrder` Implementation (`backend/src/modules/order/order.service.ts`)
- Implement `rejectOrder({ adminId, orderId, input }: { adminId: string; orderId: number; input: RejectOrderInput })`:
  1. Wrap inside `withTransaction(async (client) => { ... })`.
  2. **Lock Order:**
     `SELECT * FROM orders WHERE order_id = $1 FOR UPDATE`.
     - Check order exists (else 404 `ORDER_NOT_FOUND`).
  3. **Evaluate State:**
     - If `order.status === ORDER_STATUS.PLACED`:
       - `assertTransition(ORDER_STATUS.PLACED, ORDER_STATUS.REJECTED)` (valid).
       - Update: `UPDATE orders SET status = 'REJECTED', cancellation_reason = $1, updated_at = NOW() WHERE order_id = $2`.
       - History: `INSERT INTO order_status_history(order_id, from_status: 'PLACED', to_status: 'REJECTED', actor_id: adminId, note: input.reason)`.
     - If `order.status === ORDER_STATUS.APPROVED`:
       - Check `order.delivery_partner_id`: If NOT NULL, throw 409 `INVALID_STATE_TRANSITION` ('Order is already claimed by delivery partner and cannot be rejected').
       - `assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED)` (valid).
       - **Restock Allocated Batches:**
         - Query allocations:
           ```sql
           SELECT oa.allocation_id, oa.batch_id, oa.order_item_id, oa.quantity
           FROM order_allocations oa
           JOIN order_items oi ON oa.order_item_id = oi.order_item_id
           WHERE oi.order_id = $1
           ORDER BY oa.batch_id ASC
           ```
         - For each allocation row:
           - Call `applyLedgerEntry(client, { batchId: row.batch_id, type: LEDGER_ENTRY_TYPE.RESTOCK, delta: row.quantity, orderId, orderItemId: row.order_item_id, reason: `Order rejection restock: ${input.reason}`, userId: adminId })`.
         - Update: `UPDATE orders SET status = 'REJECTED', cancellation_reason = $1, updated_at = NOW() WHERE order_id = $2`.
         - History: `INSERT INTO order_status_history(order_id, from_status: 'APPROVED', to_status: 'REJECTED', actor_id: adminId, note: input.reason)`.
     - Any other status:
       - Throw 409 `INVALID_STATE_TRANSITION` (`assertTransition` guard).
  4. Return rejected order DTO.

### Task 3: Controller & Route Integration
- In `backend/src/modules/order/order.controller.ts`:
  - Add `rejectOrder(req, res)`: delegates to `orderService.rejectOrder`.
- In `backend/src/modules/order/order.route.ts`:
  - Mount `POST /:orderId/reject` protected by `authenticate`, `authorize([USER_ROLE.ADMIN])`, and validation.

### Task 4: Comprehensive Integration Tests (`backend/src/modules/order/__tests__/order.approval.integration.test.ts`)
- Build integration tests covering:
  1. Full approval with single batch -> verifies allocations created, `OUTWARD` ledger entries, `batches.quantity_on_hand` reduced.
  2. Multi-batch approval -> verifies ascending lock and multiple allocations on one line item.
  3. Partial fulfillment -> requested 10, picked 6; line status is `PARTIAL`, remaining 4 dropped.
  4. Zero-pick validation -> approving with 0 picked items fails with 400 `VALIDATION_ERROR`.
  5. Picking expired batch fails with 422 `BATCH_EXPIRED`.
  6. Picking inactive batch fails with 422 `BATCH_BLOCKED`.
  7. Picking batch with price incl GST > quoted price fails with 422 `PRICE_EXCEEDS_QUOTE`.
  8. Concurrent approvals on same order -> first succeeds, second gets 409 `INVALID_STATE_TRANSITION`.
  9. Rejection from `PLACED` -> status becomes `REJECTED`, reservation released.
  10. Rejection from unclaimed `APPROVED` -> generates `RESTOCK` ledger rows, restores batch on-hand stock exactly.
  11. Rejection of claimed order fails with 409 `INVALID_STATE_TRANSITION`.

---

## 3. Verification Criteria

- [ ] Rejection of `PLACED` order completes without ledger changes.
- [ ] Rejection of unclaimed `APPROVED` order applies `RESTOCK` (+quantity) to every batch.
- [ ] All 11+ integration test scenarios pass cleanly via `npm test`.
