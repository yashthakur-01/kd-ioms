# Plan 6-02: Order State Machine & Placement Transaction Engine

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-02`  
**Wave:** 2 (Core Order Engine & Concurrency Locking)  
**Dependencies:** Phase 0, Phase 5, Plan 6-01  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Implement the order state machine transition validator (`order.helpers.ts`), Zod request schemas (`order.validation.ts`), and the atomic order placement transaction service method (`order.service.ts` - `placeOrder`) featuring ascending row-level locking (`lockMedicines`), live availability calculation, inventory shortage rejection (`409 INSUFFICIENT_STOCK`), price ceiling quote check (`409 PRICE_CHANGED`), atomic document sequencing (`next_document_number('ORD')`), and atomic idempotency persistence.

---

## 2. Tasks & Detailed Instructions

### Task 1: State Machine Transition Rules (`backend/src/modules/order/order.helpers.ts`)
- Define state transition map per `tech.md` Section 11.2:
  ```ts
  import { ORDER_STATUS, OrderStatus } from '../../enums/order-status.enum.js';
  import { ConflictError } from '../../errors/app-error.js';

  export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.CANCELLED, ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED],
    [ORDER_STATUS.APPROVED]: [ORDER_STATUS.REJECTED, ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REJECTED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.REJECTED]: [],
  };

  export function assertTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new ConflictError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition order from status '${from}' to '${to}'`,
        details: { from, to, allowed },
      });
    }
  }
  ```
- Add unit tests for `assertTransition` covering all allowed transitions and disallowed illegal transitions.

### Task 2: Order Validation Schemas (`backend/src/modules/order/order.validation.ts`)
- Implement Zod validation schemas for order operations:
  ```ts
  export const placeOrderSchema = z.object({
    body: z.object({
      retailerId: z.string().uuid().optional(),
      note: z.string().trim().max(300, 'Note cannot exceed 300 characters').optional().nullable(),
      items: z.array(
        z.object({
          medicineId: z.number().int().positive('Medicine ID must be positive'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1').max(5000, 'Quantity cannot exceed 5000'),
          quotedPriceInclGst: z.string().regex(/^\d+(\.\d{2})?$/, 'quotedPriceInclGst must be a two-decimal number string'),
        })
      )
      .min(1, 'Order must contain at least 1 item')
      .max(60, 'Order cannot exceed 60 items')
      .refine(
        (items) => {
          const ids = items.map((i) => i.medicineId);
          return new Set(ids).size === ids.length;
        },
        { message: 'Order cannot contain duplicate medicine items' }
      ),
    }),
  });
  ```
- Include validation rule: if actor is `RETAILER`, `body.retailerId` is forbidden; if actor is `DELIVERY`, `body.retailerId` is required.

### Task 3: Order Placement Transaction Service (`backend/src/modules/order/order.service.ts`)
- Implement `placeOrder`:
  ```ts
  export interface PlaceOrderInput {
    actor: { id: string; role: string };
    retailerId?: string;
    note?: string | null;
    items: Array<{ medicineId: number; quantity: number; quotedPriceInclGst: string }>;
    idempotencyKey: string;
    requestHash: string;
  }
  ```
- Execution sequence inside `withTransaction(async (client) => { ... })`:
  1. Determine `targetRetailerId`:
     - If `actor.role === 'RETAILER'`: `targetRetailerId = actor.id`. Verify retailer profile approval status (`approval_status === 'APPROVED'`), throw 403 `RETAILER_NOT_APPROVED` if unapproved.
     - If `actor.role === 'DELIVERY'`: `targetRetailerId = retailerId`. Verify target retailer exists and is approved, throw 404 or 400 if invalid.
  2. Extract unique medicine IDs and sort ascending: `const medicineIds = [...new Set(items.map(i => i.medicineId))].sort((a, b) => a - b)`.
  3. Lock medicines: `await lockMedicines(client, medicineIds)`.
  4. Query sellable stock for locked medicines:
     ```sql
     SELECT b.medicine_id, COALESCE(SUM(b.quantity_on_hand), 0)::INT AS on_hand_qty,
            MAX(ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2)) AS max_price_incl_gst
     FROM batches b
     JOIN medicines m ON b.medicine_id = m.medicine_id
     WHERE b.medicine_id = ANY($1::int[]) AND b.status = 'ACTIVE' 
       AND b.expiry_date >= today_ist() AND b.quantity_on_hand > 0
     GROUP BY b.medicine_id;
     ```
  5. Query active order reservations:
     ```sql
     SELECT oi.medicine_id, COALESCE(SUM(oi.requested_quantity), 0)::INT AS reserved_qty
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     WHERE oi.medicine_id = ANY($1::int[]) AND o.status = 'PLACED'
     GROUP BY oi.medicine_id;
     ```
  6. Compute available quantity per medicine: `available_qty = GREATEST(0, on_hand_qty - reserved_qty)`.
  7. Check stock shortages:
     - Check each item's requested quantity against available quantity.
     - If any item has `quantity > available_qty`:
       - Collect short lines: `details = shortItems.map(i => ({ medicineId: i.medicineId, requested: i.quantity, available: availableMap.get(i.medicineId) || 0 }))`.
       - Throw `ConflictError` (`409 INSUFFICIENT_STOCK`, message: `'Insufficient stock for requested medicines'`, `details`).
  8. Check price quote integrity:
     - For each item, compare `parseFloat(item.quotedPriceInclGst)` against `parseFloat(maxPriceInclGst)`.
     - If `quotedPriceInclGst < maxPriceInclGst`:
       - Throw `ConflictError` (`409 PRICE_CHANGED`, message: `'One or more medicine prices have changed since quote was generated'`).
  9. Document number generation:
     - `const docRes = await client.query("SELECT next_document_number('ORD') AS order_number");`
     - `const orderNumber = docRes.rows[0].order_number;`
  10. Insert order:
      - `INSERT INTO orders (order_number, retailer_id, status, note) VALUES ($1, $2, 'PLACED', $3) RETURNING order_id, created_at;`
  11. Insert order items:
      - Multi-row insert into `order_items (order_id, medicine_id, requested_quantity, quoted_price_incl_gst)` for all items.
  12. Insert initial status history:
      - `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note) VALUES ($1, NULL, 'PLACED', $2, 'Order placed');`
  13. Save idempotency key inside the transaction:
      - Persist `(key, actor.id, requestHash, responseEnvelope)` into `idempotency_keys`.
  14. Return formatted order response envelope.

---

## 3. Verification & Acceptance Criteria
- [ ] `assertTransition` enforces state machine transitions and throws 409 `INVALID_STATE_TRANSITION` on invalid moves.
- [ ] Zod schema validates items count (1–60), quantities (1–5000), quoted prices, and unique medicine IDs.
- [ ] `placeOrder` locks medicine IDs in ascending order.
- [ ] Insufficient stock aborts transaction and returns 409 with itemized shortage details.
- [ ] Quoted prices below current catalog max abort transaction and return 409 `PRICE_CHANGED`.
- [ ] Successful placement generates document number from sequence, writes items, writes history, and saves idempotency key.
