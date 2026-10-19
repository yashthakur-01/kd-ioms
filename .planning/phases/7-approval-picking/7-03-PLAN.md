# Plan 7-03: Atomic Approval Transaction & Shortfall Dropping

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-03`  
**Wave:** 3 (Core Approval Engine)  
**Dependencies:** Plan 7-01, Plan 7-02, Phase 4, Phase 6  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the transactional order approval engine `orderService.approveOrder` and endpoint `POST /api/v1/orders/:orderId/approve`. In a single atomic database transaction, the engine acquires row-level locks on the order and all selected batches in ascending numeric order, validates business invariants (`PICK_EXCEEDS_REQUESTED`, `PICK_EXCEEDS_ON_HAND`, `BATCH_EXPIRED`, `PRICE_EXCEEDS_QUOTE`), inserts allocations into `order_allocations`, decrements physical batch stock via `applyLedgerEntry(OUTWARD)`, updates line items with fulfillment statuses (`FULL`, `PARTIAL`, `NONE`), drops shortfall quantities, and transitions the order to `APPROVED`.

---

## 2. Tasks & Detailed Instructions

### Task 1: Zod Validation Schema (`backend/src/modules/order/order.validation.ts`)
- In `backend/src/modules/order/order.validation.ts`, add:
  ```ts
  export const batchPickItemSchema = z.object({
    batchId: z.number().int().positive('Valid batchId is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(5000, 'Quantity cannot exceed 5000'),
    captureMethod: z.enum(['SCAN_CAMERA', 'SCAN_GUN', 'MANUAL']),
    scannedPayload: z.string().max(2000).optional(),
  });

  export const orderLinePickSchema = z.object({
    orderItemId: z.number().int().positive('Valid orderItemId is required'),
    allocations: z.array(batchPickItemSchema),
  });

  export const approveOrderSchema = z.object({
    picks: z.array(orderLinePickSchema).min(1, 'Picks array must cover order lines'),
  });

  export type ApproveOrderInput = z.infer<typeof approveOrderSchema>;
  ```

### Task 2: Ascending Batch Locking Helper (`backend/src/config/db.ts`)
- In `backend/src/config/db.ts`, add `lockBatches`:
  ```ts
  /**
   * Acquires row-level exclusive locks on batches in ascending numeric order to prevent deadlocks.
   */
  export async function lockBatches(
    client: pg.PoolClient,
    batchIds: number[]
  ): Promise<pg.QueryResult> {
    if (!batchIds.length) return { rows: [], rowCount: 0 } as any;
    const sorted = [...new Set(batchIds)].sort((a, b) => a - b);
    return client.query(
      `SELECT batch_id, medicine_id, status, expiry_date, quantity_on_hand, selling_price, mrp
       FROM batches
       WHERE batch_id = ANY($1::int[])
       ORDER BY batch_id ASC
       FOR UPDATE`,
      [sorted]
    );
  }
  ```

### Task 3: `orderService.approveOrder` Implementation (`backend/src/modules/order/order.service.ts`)
- Implement `approveOrder({ adminId, orderId, input }: { adminId: string; orderId: number; input: ApproveOrderInput })`:
  1. Wrap inside `withTransaction(async (client) => { ... })`.
  2. **Lock Order:**
     `SELECT * FROM orders WHERE order_id = $1 FOR UPDATE`.
     - Check order exists (else 404 `ORDER_NOT_FOUND`).
     - Check `status === ORDER_STATUS.PLACED` (else 409 `INVALID_STATE_TRANSITION`).
  3. **Fetch Order Items:**
     - Query `order_items` for `order_id = $1`.
  4. **Validate Total Picks:**
     - Check that total picked quantity across all lines > 0 (else 400 `VALIDATION_ERROR`, message: `'Cannot approve order with zero picked items. Use reject order instead'`).
  5. **Ascending Batch Locking:**
     - Extract all `batchId` values from `input.picks.flatMap(p => p.allocations.map(a => a.batchId))`.
     - Call `lockBatches(client, allBatchIds)`.
     - Map locked batch rows by `batch_id`.
  6. **Validate Allocations & Business Rules:**
     - For each line pick:
       - Verify `orderItemId` belongs to this order.
       - Verify total picked quantity <= `order_item.requested_quantity` (else 422 `PICK_EXCEEDS_REQUESTED`).
       - For each allocation:
         - Batch must exist in locked batches.
         - Batch `status === 'ACTIVE'` (else 422 `BATCH_BLOCKED`).
         - Batch `expiry_date >= today_ist()` (else 422 `BATCH_EXPIRED`).
         - Batch `medicine_id === order_item.medicine_id` (else 422 `BATCH_MEDICINE_MISMATCH`).
         - Batch `quantity_on_hand >= allocation.quantity` (else 422 `PICK_EXCEEDS_ON_HAND`).
         - Batch effective price: `ROUND(batch.selling_price * (1 + gst_rate/100), 2) <= order_item.quoted_price_incl_gst` (else 422 `PRICE_EXCEEDS_QUOTE`).
  7. **Execute Allocations & Ledger Decrements:**
     - For each allocation:
       - Insert into `order_allocations(order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method, scanned_payload)`.
       - Call `applyLedgerEntry(client, { batchId: a.batchId, type: LEDGER_ENTRY_TYPE.OUTWARD, delta: -a.quantity, orderId, orderItemId: p.orderItemId, userId: adminId })`.
  8. **Update Line Items & Order Status:**
     - Per line: `UPDATE order_items SET picked_quantity = $1, fulfilment_status = $2, updated_at = NOW() WHERE order_item_id = $3`.
       - If `picked_quantity === requested_quantity`: `fulfilment_status = 'FULL'`.
       - If `picked_quantity > 0`: `fulfilment_status = 'PARTIAL'`.
       - If `picked_quantity === 0`: `fulfilment_status = 'NONE'`.
     - Update order: `UPDATE orders SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW() WHERE order_id = $1`.
     - Insert `order_status_history(order_id, from_status: 'PLACED', to_status: 'APPROVED', actor_id: adminId, note: 'Order approved with picked batch allocations')`.
  9. Return approved order DTO with itemized fulfillment status.

### Task 4: Controller & Router Integration
- In `backend/src/modules/order/order.controller.ts`:
  - Add `approveOrder(req, res)`: delegates to `orderService.approveOrder({ adminId: req.user.id, orderId: Number(req.params.orderId), input: req.body })`.
- In `backend/src/modules/order/order.route.ts`:
  - Mount `POST /:orderId/approve` protected by `authenticate`, `authorize([USER_ROLE.ADMIN])`, and validation.

---

## 3. Verification Criteria

- [ ] `POST /api/v1/orders/:orderId/approve` locks batches in ascending order and decrements inventory via `applyLedgerEntry(OUTWARD)`.
- [ ] Over-picking line, picking expired batch, or picking batch exceeding price quote is rejected with 422.
- [ ] Attempting approval on non-PLACED order is rejected with 409 `INVALID_STATE_TRANSITION`.
- [ ] Shortfalls are dropped; lines with partial pick are marked `PARTIAL`.
