# Phase 8 Context: Delivery, Refusal and Proof

*See full details at [`.planning/phases/8-delivery-refusal/8-CONTEXT.md`](.planning/phases/8-delivery-refusal/8-CONTEXT.md)*

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 8`)  

### Key Decisions Locked:
1. **Atomic Pool Claim (ADR-033):** Delivery claim uses a single atomic SQL statement `UPDATE orders SET status = 'OUT_FOR_DELIVERY', delivery_partner_id = $1, claimed_at = NOW() WHERE order_id = $2 AND status = 'APPROVED' AND delivery_partner_id IS NULL RETURNING *`. Concurrent competitors receive 409 `ORDER_ALREADY_CLAIMED`.
2. **Whole-Line Doorstep Refusal (ADR-034):** Doorstep decision is per whole line item (accept all picked units or refuse all with a 3–200 char reason). No partial line returns and no post-delivery returns.
3. **Append-Only Stock Return (ADR-035):** Each refused line triggers `applyLedgerEntry(RETURN_IN)` (+delta) for all underlying allocations in `order_allocations`, immediately restoring original batch inventory.
4. **Delivery Proof & Pre-Transaction Storage (ADR-036):** Photo proof (JPEG/PNG/WebP, max 5MB) uploaded via Supabase Storage with local filesystem fallback for offline/CI test environments. Upload failure immediately aborts with 502 `EXTERNAL_SERVICE_ERROR` before database transaction begins, keeping inventory and order status intact.
5. **Partner Release & Admin Override (ADR-037):** Assigned partner can self-release an `OUT_FOR_DELIVERY` order back to `APPROVED` in the pool (`POST /delivery/orders/:orderId/release`), and Admin can override/reassign (`POST /delivery/orders/:orderId/override`).
6. **Standardized Delivery Frontend Hierarchy (ADR-038):** Mobile-first UI aligned with backend route structure: `/delivery/pool`, `/delivery/orders`, `/delivery/orders/[orderId]`, and `/delivery/orders/new`. `(delivery)/layout.tsx` `BottomNav` synchronized.
