# Phase 6 Context: Order Placement and Cancellation

*See full details at [`.planning/phases/6-order-placement-cancel/6-CONTEXT.md`](file:///home/yash/D/kd-ioms/.planning/phases/6-order-placement-cancel/6-CONTEXT.md)*

**Phase:** Phase 6 — Order Placement and Cancellation  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 6`)  

### Key Decisions Locked:
1. **Idempotency Key & Request Hash Protection (ADR-023):** Header `Idempotency-Key` (UUID) with SHA-256 payload hash stored in `idempotency_keys` table (`key, user_id, request_hash, response, created_at`). Same payload replays cached 200 response with `X-Idempotent-Replay: true`. Different payload with same key rejects with 409 `IDEMPOTENCY_KEY_REUSED`. Permanent retention policy for completed order auditability.
2. **Ascending Row Locking & Concurrency Reservation (ADR-024):** In a single database transaction, `lockMedicines(client, medicineIds)` locks medicine IDs in ascending numeric order to eliminate deadlocks. Dynamic availability is recomputed against sellable on-hand stock minus `PLACED` reservations. If requested quantity > available quantity for any item, transaction aborts with 409 `INSUFFICIENT_STOCK` and itemized shortage details `[{ medicineId, requested, available }]`.
3. **Price Ceiling Validation & Stale Quote Rejection (ADR-025):** Each line item's `quotedPriceInclGst` is checked against current catalog maximum price incl. GST (`max_price_incl_gst`). If quote < catalog maximum, transaction aborts with 409 `PRICE_CHANGED`.
4. **Strict Order State Machine & Retailer Cancellation (ADR-026):** State machine enforces transitions via `assertTransition(from, to)`. Retailer can cancel their own order only while `PLACED` (rejecting any later status with 409 `INVALID_STATE_TRANSITION`). Cancelling immediately releases reservation and restores catalog availability. Tenant isolation guarantees cross-retailer order queries return 404 `NOT_FOUND`.
5. **Interactive Cart Shortage Handling & Delivery On-Behalf:** Cart checkout page (`/cart`) displays one-tap "Use Available" button on short lines to clamp quantities directly to available stock. Delivery partners place orders on behalf of pharmacies via dedicated `/delivery/orders/new` flow. Orders timeline (`OrderTimeline`) displays clear status milestones.
