# Plan 8-02: Delivery Dispatch Pool & Atomic Claim Service

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-02`  
**Wave:** 2 (Pool, Claim, Release & Override)  
**Dependencies:** Plan 8-01  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Implement the delivery dispatch pool, atomic claim engine, partner self-release, admin override, and partner order listing endpoints. The claim engine uses conditional SQL update execution ensuring race conditions are resolved atomically (first caller wins; subsequent concurrent callers receive 409 `ORDER_ALREADY_CLAIMED`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Delivery Types & Validation Schemas (`delivery.types.ts`, `delivery.validation.ts`)
- Create `backend/src/modules/delivery/delivery.types.ts`:
  - `PoolOrderDto`: `orderId`, `orderNumber`, `retailer: { userId, shopName, city, pincode, phone }`, `itemCount`, `totalAmount`, `approvedAt`, `createdAt`.
  - `ClaimOrderResult`: `orderId`, `orderNumber`, `status: 'OUT_FOR_DELIVERY'`, `retailer: { shopName, addressLine, city, pincode, phone }`, `items: ...`.
  - `PartnerOrderSummaryDto`: `orderId`, `orderNumber`, `status`, `retailerShopName`, `city`, `itemCount`, `totalAmount`, `claimedAt`, `deliveredAt`.
  - `DeliveryOrderDetailDto`: full order details, retailer address/phone, and line items with `order_allocations` (`batchNumber`, `expiryDate`, `quantity`).
- Create `backend/src/modules/delivery/delivery.validation.ts`:
  - `poolQuerySchema`: `page` (default 1), `pageSize` (default 20, max 50).
  - `partnerOrdersQuerySchema`: `status` (optional `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`), `page`, `pageSize`.
  - `releaseBodySchema`: `reason` (optional string, max 300).
  - `overrideBodySchema`: `targetPartnerId` (optional UUID or null), `reason` (required string 5–300 chars).

### Task 2: Delivery Service (`backend/src/modules/delivery/delivery.service.ts`)
- Implement:
  1. `getPoolOrders(options)`:
     - Query `orders` joined with `users` and `retailer_profiles` where `o.status = 'APPROVED' AND o.delivery_partner_id IS NULL`.
     - Order by `o.created_at ASC` (oldest first).
     - Calculate items count and total amount.
     - Return paginated results with standard meta envelope.
  2. `claimOrder({ partnerId, orderId })`:
     - Execute atomic conditional update:
       ```sql
       UPDATE orders
       SET status = 'OUT_FOR_DELIVERY',
           delivery_partner_id = $1,
           claimed_at = NOW(),
           updated_at = NOW()
       WHERE order_id = $2 AND status = 'APPROVED' AND delivery_partner_id IS NULL
       RETURNING order_id, order_number, status, claimed_at;
       ```
     - If `rowCount === 0`:
       - Query order state: if not found -> throw 404 `NOT_FOUND`.
       - If `delivery_partner_id IS NOT NULL` -> throw 409 `ORDER_ALREADY_CLAIMED` ("This order has already been claimed by another delivery partner").
       - If `status !== 'APPROVED'` -> throw 409 `INVALID_STATE_TRANSITION` ("Order is not in APPROVED status").
     - Insert into `order_status_history`: `from_status = 'APPROVED', to_status = 'OUT_FOR_DELIVERY', actor_id = partnerId, note = 'Order claimed for delivery'`.
     - Fetch full order stop details with retailer contact and return.
  3. `releaseOrder({ actor, orderId, reason })`:
     - Select order `FOR UPDATE`.
     - Assert `status === 'OUT_FOR_DELIVERY'`.
     - If `actor.role === 'DELIVERY'`, verify `delivery_partner_id === actor.userId` (else throw 403 `FORBIDDEN`).
     - Update orders: `status = 'APPROVED', delivery_partner_id = NULL, claimed_at = NULL, updated_at = NOW()`.
     - Record in `order_status_history`: `from_status = 'OUT_FOR_DELIVERY', to_status = 'APPROVED', actor_id = actor.userId, note = reason || 'Order released back to dispatch pool'`.
  4. `overrideOrder({ adminId, orderId, targetPartnerId, reason })`:
     - Admin only. Lock order `FOR UPDATE`.
     - Assert `status === 'OUT_FOR_DELIVERY'`.
     - If `targetPartnerId === null`: reset to pool (`status = 'APPROVED', delivery_partner_id = NULL, claimed_at = NULL`).
     - If `targetPartnerId` provided: reassign `delivery_partner_id = targetPartnerId`.
     - Record in `order_status_history`.
  5. `getPartnerOrders({ partnerId, status, page, pageSize })`:
     - Returns orders where `delivery_partner_id = partnerId`, sorted by `claimed_at DESC`.
  6. `getOrderDetail({ actor, orderId })`:
     - Fetch order, retailer contact & address (`shop_name`, `address_line`, `city`, `state`, `pincode`, `whatsapp_number`, `userPhone`).
     - Verify actor is assigned delivery partner or admin; otherwise throw 404 `NOT_FOUND` / 403 `FORBIDDEN`.
     - Fetch items and batch allocations (`batchNumber`, `expiryDate`, `quantity`).

### Task 3: Delivery Controller & Route Registration (`delivery.controller.ts`, `delivery.route.ts`)
- Implement controller handlers delegating to service and returning standard envelope responses.
- Define routes in `delivery.route.ts`:
  - `GET /pool` -> `authenticate`, `authorize([USER_ROLE.DELIVERY, USER_ROLE.ADMIN])`, `getPool`
  - `POST /orders/:orderId/claim` -> `authenticate`, `authorize([USER_ROLE.DELIVERY])`, `claimOrder`
  - `POST /orders/:orderId/release` -> `authenticate`, `authorize([USER_ROLE.DELIVERY, USER_ROLE.ADMIN])`, `releaseOrder`
  - `POST /orders/:orderId/override` -> `authenticate`, `authorize([USER_ROLE.ADMIN])`, `overrideOrder`
  - `GET /orders` -> `authenticate`, `authorize([USER_ROLE.DELIVERY])`, `getPartnerOrders`
  - `GET /orders/:orderId` -> `authenticate`, `authorize([USER_ROLE.DELIVERY, USER_ROLE.ADMIN])`, `getOrderDetail`
- Mount `router.use('/delivery', deliveryRouter)` in `backend/src/routes/index.ts`.

### Task 4: Integration Tests (`backend/src/modules/delivery/__tests__/delivery.claim.test.ts`)
- Integration tests:
  1. `GET /delivery/pool` returns approved orders with no partner, oldest first.
  2. Concurrency test: 10 parallel claims against the same approved order; exactly 1 receives 200 and becomes `OUT_FOR_DELIVERY`, 9 receive 409 `ORDER_ALREADY_CLAIMED`.
  3. Claiming an order already out for delivery or cancelled returns 409.
  4. Assigned delivery partner can release order back to pool; order reappears in `GET /delivery/pool`.
  5. Non-assigned delivery partner attempting to release or view order gets rejected.
  6. Admin can override and return stuck order to pool or reassign.

---

## 3. Verification Criteria

- [ ] `GET /api/v1/delivery/pool` correctly lists unassigned approved orders.
- [ ] 10-concurrent-claim race test passes cleanly without deadlock or double claim.
- [ ] Partner release and Admin override reset order state to `APPROVED` and record history.
- [ ] Integration tests pass cleanly via `npm test -- backend/src/modules/delivery/__tests__/delivery.claim.test.ts`.
