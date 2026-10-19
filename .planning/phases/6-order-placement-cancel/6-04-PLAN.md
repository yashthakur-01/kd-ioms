# Plan 6-04: Backend Concurrency, Idempotency & Tenant Isolation Tests

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-04`  
**Wave:** 4 (Backend Automated Test Verification)  
**Dependencies:** Plan 6-01, Plan 6-02, Plan 6-03  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver a comprehensive integration test suite for the `order` module (`backend/src/modules/order/__tests__/order.integration.test.ts`), rigorously validating high-concurrency race conditions, idempotency determinism, price quote protection, state machine invariants, retailer cancellation, and tenant isolation.

---

## 2. Tasks & Detailed Instructions

### Task 1: Order Placement & Concurrency Integration Tests (`order.integration.test.ts`)
- Author test suite verifying:
  1. **Concurrency Race Condition Test:**
     - Setup: Medicine with 10 units available.
     - Action: Launch 2 concurrent order placement requests (`Promise.all`) requesting 7 units each with distinct `Idempotency-Key` headers.
     - Expectation: Exactly 1 request succeeds with 201 `PLACED`; the other request fails with 409 `INSUFFICIENT_STOCK` and `details: [{ medicineId, requested: 7, available: 3 }]`.
     - Verify: Final inventory shows 7 units reserved and 3 available.
  2. **Idempotency Replay Test:**
     - Place an order with `Idempotency-Key: uuid-1`.
     - Replay identical request with `Idempotency-Key: uuid-1` and exact same payload.
     - Expectation: Returns 200 OK with cached response envelope and header `X-Idempotent-Replay: true`.
     - Verify: No duplicate order created in `orders` table; document sequence current value only incremented once.
  3. **Idempotency Payload Tampering Rejection Test:**
     - Place an order with `Idempotency-Key: uuid-2`.
     - Replay request with `Idempotency-Key: uuid-2` but altered item quantity or note.
     - Expectation: Returns 409 `IDEMPOTENCY_KEY_REUSED`.
  4. **Stale Price Quote Rejection Test:**
     - Given a medicine whose current catalog selling price incl. GST is `250.00`.
     - Attempt to place order with `quotedPriceInclGst: '200.00'`.
     - Expectation: Returns 409 `PRICE_CHANGED`. No order created.
     - Attempt to place order with `quotedPriceInclGst: '250.00'` or `'260.00'`.
     - Expectation: Succeeds with 201 Created.
  5. **Unapproved Retailer Gating Test:**
     - Attempt to place order as a retailer with `PENDING` or `REJECTED` approval status.
     - Expectation: Returns 403 `RETAILER_NOT_APPROVED`.

### Task 2: Cancellation & Tenant Isolation Integration Tests
- Author tests verifying:
  1. **Retailer Order Cancellation:**
     - Retailer places order (status `PLACED`).
     - Retailer calls `POST /api/v1/orders/:orderId/cancel` with optional reason.
     - Expectation: Returns 200 OK; order status transitions to `CANCELLED`, `cancelled_at` is populated.
     - Availability check: Verify `v_medicine_availability` immediately restores `available_qty` to its pre-order level.
  2. **Invalid State Cancellation Invariant:**
     - Order status is moved to `APPROVED` or `OUT_FOR_DELIVERY`.
     - Retailer attempts to cancel order.
     - Expectation: Returns 409 `INVALID_STATE_TRANSITION`.
  3. **Tenant Isolation on Detail Query (`GET /orders/:orderId`):**
     - Retailer A places Order 10.
     - Retailer B attempts to query `GET /api/v1/orders/10`.
     - Expectation: Returns 404 `ORDER_NOT_FOUND` (NOT 403, preventing ID harvesting).
     - Admin queries `GET /api/v1/orders/10`.
     - Expectation: Returns 200 OK with full items and allocation information.
  4. **Tenant Isolation on Order List (`GET /orders`):**
     - Retailer A queries `GET /api/v1/orders`.
     - Expectation: Returns only orders belonging to Retailer A.
     - Admin queries `GET /api/v1/orders`.
     - Expectation: Returns orders across all retailers.
  5. **Delivery Partner On-Behalf Placement:**
     - Delivery partner places order with valid `retailerId` for an approved pharmacy.
     - Expectation: Order placed with `retailer_id = targetRetailerId` and status `PLACED`.
     - If `retailerId` missing or points to unapproved retailer: Returns 400 or 404.

---

## 3. Verification & Acceptance Criteria
- [ ] Concurrency test proves exactly 1 winner when competing for limited stock; loser receives 409 `INSUFFICIENT_STOCK`.
- [ ] Idempotency replay returns cached 200 response without duplicating orders or sequence increments.
- [ ] Payload modification with used key returns 409 `IDEMPOTENCY_KEY_REUSED`.
- [ ] Stale price quotes return 409 `PRICE_CHANGED`.
- [ ] Order cancellation while `PLACED` succeeds and immediately restores availability.
- [ ] Cancellation after approval/dispatch returns 409 `INVALID_STATE_TRANSITION`.
- [ ] Cross-retailer order queries return 404 `NOT_FOUND`.
- [ ] All tests pass cleanly (`npm test --workspace=backend`).
