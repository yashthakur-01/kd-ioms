# Phase 6 Context: Order Placement and Cancellation

**Phase:** Phase 6 — Order Placement and Cancellation  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 6`)  
**Primary Source:** [`tech.md`](file:///home/yash/D/kd-ioms/tech.md) Section 11, Section 2.1, Section 2.8, Section 2.9, Section 3.2, and [`ROADMAP.md`](file:///home/yash/D/kd-ioms/.planning/ROADMAP.md) Phase 6  

---

## 1. Phase Objective & Boundary

Implement end-to-end order placement, dynamic inventory reservation, price quote integrity validation, idempotency protection, and retailer order cancellation for approved retailers and delivery partners:

1. **Database Migration (`004_idempotency_keys.sql`):**
   - Create table `idempotency_keys(key UUID, user_id UUID REFERENCES users(id) ON DELETE CASCADE, request_hash TEXT NOT NULL, response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (key, user_id))` with index on `created_at`.
   - Permanent retention policy for deterministic replay and audit logging.
2. **Order Placement Transaction Engine (`orderService.place`):**
   - Atomic database transaction wrapped in `withTransaction`.
   - Deadlock-free ascending row-level locking on medicines: `lockMedicines(client, medicineIds)`.
   - Real-time availability verification against live sellable stock minus existing `PLACED` reservations.
   - Concurrency reservation: If requested quantity > available quantity for any medicine, transaction aborts with 409 `INSUFFICIENT_STOCK` and itemized shortage details `[{ medicineId, requested, available }]`.
   - Price ceiling integrity: Compares each item's `quotedPriceInclGst` against current catalog maximum price incl. GST (`max_price_incl_gst`). If quote < catalog maximum, transaction aborts with 409 `PRICE_CHANGED`.
   - Document sequencing: `next_document_number('ORD')` generates atomic sequential order number (e.g., `ORD-000001`).
   - Atomic multi-row insertion: `orders` (`status = 'PLACED'`), `order_items`, initial `order_status_history` (`to_status = 'PLACED'`), and cached `idempotency_keys` record.
3. **Idempotency Protection Middleware (`middleware/idempotency.ts`):**
   - Intercepts requests with header `Idempotency-Key` (UUID).
   - Generates SHA-256 hash of canonicalized request payload.
   - For matching `(key, user_id)`:
     - If `request_hash` matches: replays cached 200 OK response with `X-Idempotent-Replay: true` without invoking handlers or mutating state.
     - If `request_hash` differs: rejects with 409 `IDEMPOTENCY_KEY_REUSED`.
4. **Order State Machine & Cancellation (`order.helpers.ts`):**
   - Enforce state machine transitions: `PLACED -> CANCELLED` (retailer for own order, only while `PLACED`), `PLACED -> APPROVED` (admin, Phase 7), `PLACED -> REJECTED` (admin, Phase 7).
   - Any invalid transition attempt throws 409 `INVALID_STATE_TRANSITION`.
   - Cancelling an order releases its reservation immediately, automatically restoring sellable availability in `v_medicine_availability` without manual ledger adjustments.
   - Tenant isolation: Retailer querying another retailer's order on `GET /orders/:orderId` receives 404 `NOT_FOUND` (preventing ID harvesting).
5. **Frontend Cart Checkout, Order Timeline & Delivery Partner Flow:**
   - `/cart`: Full cart checkout review with quantity adjustments, line subtotals, grand total, optional note (max 300 chars), and single-click "Place Order" button with per-attempt idempotency key generation.
   - Interactive Shortage Handling: On 409 `INSUFFICIENT_STOCK`, highlights short items with amber/red badges and a one-tap "Use Available" button that clamps quantity to available stock (or removes if 0).
   - `/orders`: Paginated, filterable order history (status, date range, search query).
   - `/orders/:orderId`: Comprehensive order view with `OrderTimeline` component showing lifecycle progression and a Cancel Order confirmation modal (available only while `PLACED`).
   - `/delivery/orders/new`: Dedicated delivery partner workflow to select an approved pharmacy and place orders on their behalf.

---

## 2. Locked Implementation Decisions

### 2.1 Database & Schema Architecture (`004_idempotency_keys.sql`)

```sql
-- Migration 004_idempotency_keys.sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, user_id)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx ON idempotency_keys(created_at);
```

- **Scope & Isolation:** Scoped per `(key, user_id)` so two distinct users submitting the same UUID do not collide.
- **Retention Policy:** Kept permanently for auditability and guaranteed idempotent replays on network retries.

### 2.2 Order State Machine & Transition Rules (`order.helpers.ts`)

| From Status | To Status | Allowed Actor | Condition / Context | Error on Invalid Attempt |
|---|---|---|---|---|
| `PLACED` | `CANCELLED` | Retailer (own order) | Only while status is `PLACED` | 409 `INVALID_STATE_TRANSITION` |
| `PLACED` | `APPROVED` | Admin | Phase 7 picking & batch allocation | 409 `INVALID_STATE_TRANSITION` |
| `PLACED` | `REJECTED` | Admin | Phase 7 administrative rejection | 409 `INVALID_STATE_TRANSITION` |
| `APPROVED` | `REJECTED` | Admin | Phase 7 unclaimed order rejection | 409 `INVALID_STATE_TRANSITION` |
| `APPROVED` | `OUT_FOR_DELIVERY` | Delivery Partner | Phase 8 batch claim | 409 `INVALID_STATE_TRANSITION` |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Delivery Partner | Phase 8 proof of delivery | 409 `INVALID_STATE_TRANSITION` |
| `OUT_FOR_DELIVERY` | `REJECTED` | Delivery Partner | Phase 8 100% item doorstep refusal | 409 `INVALID_STATE_TRANSITION` |

- `assertTransition(from: OrderStatus, to: OrderStatus)`: Throws `ConflictError` with code `INVALID_STATE_TRANSITION` for any disallowed transition.
- Every state transition inserts a record into `order_status_history(order_id, from_status, to_status, actor_id, note, created_at)`.

### 2.3 Idempotency Protection Middleware (`middleware/idempotency.ts`)

1. **Header Requirement:** Requires `Idempotency-Key` header matching standard UUID v4 format on state-mutating order placement routes.
2. **Payload Hash Computation:** Computes SHA-256 hash of sorted/canonical JSON request body:
   ```ts
   const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
   ```
3. **Lookup & Replay:**
   - If row exists for `(key, req.user.id)`:
     - If `row.request_hash === requestHash`: Replay stored `response` immediately with HTTP status 200 and header `X-Idempotent-Replay: true`. Terminate request without invoking controllers.
     - If `row.request_hash !== requestHash`: Throw 409 `ConflictError` with code `IDEMPOTENCY_KEY_REUSED` ("Idempotency key was previously used with a different request payload").
4. **Atomic Insertion:**
   - The response payload is persisted into `idempotency_keys` in the same database transaction as the order creation, ensuring the key is saved if and only if the order commits.

### 2.4 Placement Transaction Workflow (`orderService.place`)

Executed inside `withTransaction(async (client) => { ... })`:

1. **Ascending Row-Level Lock:**
   - Extract unique `medicine_id` values from `items`.
   - Call `lockMedicines(client, sortedMedicineIds)` (`SELECT medicine_id FROM medicines WHERE medicine_id = ANY($1) ORDER BY medicine_id ASC FOR UPDATE`).
   - Prevents deadlock when concurrent transactions order overlapping medicines.
2. **Availability Recomputation:**
   - Query sellable stock for locked medicines:
     ```sql
     SELECT b.medicine_id, COALESCE(SUM(b.quantity_on_hand), 0)::INT AS on_hand_qty,
            MAX(ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2)) AS max_price_incl_gst
     FROM batches b
     JOIN medicines m ON b.medicine_id = m.medicine_id
     WHERE b.medicine_id = ANY($1::int[]) AND b.status = 'ACTIVE' 
       AND b.expiry_date >= today_ist() AND b.quantity_on_hand > 0
     GROUP BY b.medicine_id
     ```
   - Query reserved stock for locked medicines:
     ```sql
     SELECT oi.medicine_id, COALESCE(SUM(oi.requested_quantity), 0)::INT AS reserved_qty
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     WHERE oi.medicine_id = ANY($1::int[]) AND o.status = 'PLACED'
     GROUP BY oi.medicine_id
     ```
   - Calculate `available_qty = GREATEST(0, on_hand_qty - reserved_qty)`.
3. **Stock Shortage Verification:**
   - If any item has `quantity > available_qty`:
     - Collect all short lines: `details = items.filter(...).map(i => ({ medicineId: i.medicineId, requested: i.quantity, available: availableMap.get(i.medicineId) || 0 }))`.
     - Throw `ConflictError` with code `INSUFFICIENT_STOCK`, message `'Insufficient stock for requested medicines'`, and `details`.
     - Transaction rolls back, preserving database integrity.
4. **Price Ceiling Verification:**
   - For each item, compare `quotedPriceInclGst` against current `max_price_incl_gst`.
   - If `parseFloat(item.quotedPriceInclGst) < parseFloat(maxPriceInclGst)`:
     - Throw `ConflictError` with code `PRICE_CHANGED`, message `'One or more medicine prices have changed since quote was generated'`.
     - Transaction rolls back.
5. **Sequence Numbering:**
   - Query `SELECT next_document_number('ORD') AS order_number`.
6. **Order & Items Insertion:**
   - Insert into `orders (order_number, retailer_id, status, note)` returning `order_id, created_at`.
   - Batch insert into `order_items (order_id, medicine_id, requested_quantity, quoted_price_incl_gst)`.
   - Insert into `order_status_history (order_id, from_status, to_status, actor_id, note)` with `to_status = 'PLACED', note = 'Order placed'`.
7. **Idempotency Key Persistence:**
   - Insert into `idempotency_keys (key, user_id, request_hash, response)`.
8. **Return 201 Created DTO:**
   - `{ orderId, orderNumber, status: 'PLACED', retailerId, items, totalAmount, note, createdAt }`.

### 2.5 Cancellation Workflow (`orderService.cancel`)

1. **Access & State Validation:**
   - Begin transaction, query `orders WHERE order_id = $1 FOR UPDATE`.
   - If order not found: throw 404 `NotFoundError` (`ORDER_NOT_FOUND`).
   - If `actor.role === 'RETAILER'` and `order.retailer_id !== actor.id`:
     - Throw 404 `NotFoundError` (Strict tenant isolation; do not leak existence).
   - Check status: If `order.status !== 'PLACED'`:
     - Throw 409 `ConflictError` with code `INVALID_STATE_TRANSITION`, message `Cannot cancel order in status ${order.status}`.
2. **Execute Cancellation:**
   - Update `orders SET status = 'CANCELLED', cancelled_at = NOW(), rejection_reason = $2, updated_at = NOW() WHERE order_id = $1`.
   - Insert `order_status_history(order_id, from_status, to_status, actor_id, note)` with `from_status = 'PLACED', to_status = 'CANCELLED', note = reason || 'Order cancelled by retailer'`.
3. **Immediate Availability Restoration:**
   - Because `v_medicine_availability` only deducts orders where `status = 'PLACED'`, moving to `CANCELLED` instantly frees reserved quantities without manual stock adjustment.

### 2.6 Backend API Contracts

#### `POST /api/v1/orders`
- **Access Control:** `authenticate` + `requireApprovedRetailer` (for retailers) or `authorize(['DELIVERY'])`.
- **Headers:** `Idempotency-Key: <UUID v4>` (Required).
- **Body Schema:**
  ```json
  {
    "retailerId": "uuid-optional-required-only-for-delivery",
    "note": "Optional delivery instructions up to 300 characters",
    "items": [
      {
        "medicineId": 14,
        "quantity": 5,
        "quotedPriceInclGst": "201.15"
      }
    ]
  }
  ```
- **Validation Rules:**
  - `items`: 1–60 items, no duplicate `medicineId`.
  - `quantity`: Integer between 1 and 5000.
  - `quotedPriceInclGst`: Two-decimal string format (`^\d+(\.\d{2})?$`).
  - `note`: Optional string, max 300 characters.
  - `retailerId`: Required if actor is `DELIVERY` (must reference an `APPROVED` retailer); forbidden if actor is `RETAILER`.
- **Responses:**
  - `201 Created`: Placed order payload.
  - `200 OK`: Replayed order payload on duplicate idempotency key with identical body (`X-Idempotent-Replay: true`).
  - `400 VALIDATION_ERROR`: Missing fields, invalid UUID, duplicate medicines.
  - `409 INSUFFICIENT_STOCK`: Short inventory with details array `[{ medicineId, requested, available }]`.
  - `409 PRICE_CHANGED`: Quoted price below current catalog maximum.
  - `409 IDEMPOTENCY_KEY_REUSED`: Same key used with different request body.

#### `GET /api/v1/orders`
- **Access Control:** `authenticate` (Retailer, Admin, Delivery).
- **Query Parameters:** `status`, `from` (ISO date), `to` (ISO date), `retailerId` (Admin/Delivery), `q` (order number search), `page` (default 1), `pageSize` (default 20), `sort` (`createdAt`, `-createdAt`).
- **Tenant Isolation:** Retailers automatically filtered by `retailer_id = actor.id`.
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "code": "OK",
    "message": "Orders retrieved successfully",
    "data": [
      {
        "orderId": 1,
        "orderNumber": "ORD-000001",
        "retailer": {
          "id": "uuid",
          "name": "Apollo Pharmacy",
          "pharmacyName": "Apollo Pharmacy Indiranagar"
        },
        "status": "PLACED",
        "itemCount": 3,
        "totalAmount": "1005.75",
        "createdAt": "2026-10-19T16:30:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "pageSize": 20,
      "total": 12,
      "totalPages": 1
    }
  }
  ```

#### `GET /api/v1/orders/:orderId`
- **Access Control:** `authenticate`.
- **Tenant Isolation:** If actor is Retailer, order must belong to them; otherwise returns 404 `NOT_FOUND`.
- **Response Shape (200 OK):** Full order including items, summary, and status history.
  - `items`: array with `orderItemId`, `medicineId`, `name`, `company`, `packSize`, `requestedQuantity`, `quotedPriceInclGst`, `pickedQuantity`, `fulfilmentStatus`, `deliveryStatus`.
  - `history`: array with `historyId`, `fromStatus`, `toStatus`, `actorId`, `actorName`, `actorRole`, `note`, `createdAt`.
  - `allocations`: array of batch allocations included only for Admin and Delivery; omitted for Retailer.

#### `POST /api/v1/orders/:orderId/cancel`
- **Access Control:** `authenticate` + Retailer (owner of order).
- **Body:** `{ "reason": "Optional reason up to 300 characters" }`.
- **Responses:**
  - `200 OK`: Updated order with `status = 'CANCELLED'`, `cancelledAt`.
  - `404 NOT_FOUND`: Order does not exist or belongs to another retailer.
  - `409 INVALID_STATE_TRANSITION`: Order is already approved, out for delivery, or completed.

### 2.7 Frontend UX & Component Architecture

1. **Cart Checkout View (`/cart`):**
   - Header with item count and "Continue Shopping" link back to `/catalog`.
   - Items list table: Medicine title, company, pack size, unit price incl. GST, quantity stepper clamped to `[1, maxAvailable]`, line total, and remove item action.
   - Retailer delivery note input (optional, max 300 chars with counter).
   - Order summary box: Subtotal incl. GST, item count, and primary "Place Order" button.
   - **Idempotency Lifecycle:**
     - Generates UUID `crypto.randomUUID()` when checkout initiates.
     - Reuses same UUID on network retries.
     - Generates fresh UUID if user modifies cart items or note.
   - **Shortage Error Handling (409 `INSUFFICIENT_STOCK`):**
     - Short lines highlighted with amber border and warning badge (`Only X available`).
     - "Use Available" button directly updates item quantity to `available` (or removes item if `available === 0`).
     - Updates total calculation and enables user to place order immediately.
   - **Price Change Handling (409 `PRICE_CHANGED`):**
     - Displays error alert with action "Refresh Prices & Cart".
   - **Post-Placement:**
     - Calls `clearCart()` upon 201 Created or 200 Replay.
     - Redirects user to `/orders/:orderId`.

2. **Order Detail & Timeline (`/orders/:orderId` & `OrderTimeline.tsx`):**
   - `OrderTimeline`: Visual horizontal/vertical stepper showing order milestones:
     - `PLACED`: Checkmark + timestamp.
     - `APPROVED`: Feeds to `OUT_FOR_DELIVERY` -> `DELIVERED`.
     - Branching for `CANCELLED` / `REJECTED`: Clear red badge with cancellation reason.
   - Cancel Order Modal:
     - Visible only when `order.status === 'PLACED'` for retailer.
     - Confirmation dialog with optional reason field (max 300 chars).
     - Dispatches `POST /orders/:orderId/cancel` and updates state in-place.

3. **Delivery Partner On-Behalf Flow (`/delivery/orders/new`):**
   - Step 1: Search and select approved retailer from list.
   - Step 2: Renders catalog and cart with prominent top banner: `Placing order on behalf of: [Pharmacy Name]`.
   - Step 3: Automatically attaches `retailerId` to `POST /api/v1/orders`.

---

## 3. Verification & Automated Test Matrix

1. **Concurrency Race Condition Test:**
   - Setup: Medicine with 10 units available.
   - Action: 2 concurrent requests order 7 units each with distinct idempotency keys.
   - Expectation: Exactly 1 request succeeds with 201 `PLACED`; second request fails with 409 `INSUFFICIENT_STOCK` and `details: [{ medicineId, requested: 7, available: 3 }]`.
2. **Idempotency Key Determinism Tests:**
   - Replay same `Idempotency-Key` and identical body: Returns 200 OK with cached response; no new database records created; `X-Idempotent-Replay: true`.
   - Replay same `Idempotency-Key` with modified body (e.g., changed quantity): Returns 409 `IDEMPOTENCY_KEY_REUSED`.
   - Invalid `Idempotency-Key` header (non-UUID): Returns 400 `VALIDATION_ERROR`.
3. **Price Protection Tests:**
   - Order sent with `quotedPriceInclGst` lower than current catalog maximum price incl. GST: Returns 409 `PRICE_CHANGED`.
   - Order sent with `quotedPriceInclGst` equal to or higher than catalog maximum: Successfully places order.
4. **State Machine & Cancellation Invariant Tests:**
   - Retailer cancels order while `status = 'PLACED'`: Successfully moves to `CANCELLED`, records history, and restores catalog `available_qty`.
   - Retailer attempts to cancel order after status changed to `APPROVED` or `OUT_FOR_DELIVERY`: Fails with 409 `INVALID_STATE_TRANSITION`.
   - Delivery partner or non-owner retailer attempts to cancel order: Fails with 404 or 403.
5. **Tenant Isolation Tests:**
   - Retailer A queries `GET /orders/:orderId` for an order belonging to Retailer B: Returns 404 `NOT_FOUND` (no data leakage).
   - Retailer A queries `GET /orders`: Only returns orders where `retailer_id = Retailer A`.
   - Admin queries `GET /orders/:orderId` for any retailer: Returns 200 with full details and allocations.
6. **Frontend Component & Integration Tests:**
   - Cart checkout calculates accurate line totals and grand total in paise.
   - One-tap "Use Available" button clamps quantity correctly and clears shortage error.
   - `OrderTimeline` renders milestones accurately for all statuses.
   - Delivery partner flow passes `retailerId` properly.
