# Phase 8 Plan: Delivery, Refusal and Proof

*See full master plan and wave breakdown at [`.planning/phases/8-delivery-refusal/8-PLAN.md`](.planning/phases/8-delivery-refusal/8-PLAN.md)*

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Responsible Developer:** `dev2`  
**Status:** 📋 READY FOR EXECUTION  

### Wave Breakdown:
- **Wave 1 (`8-01`):** Photo Storage Utility & Multer Setup (`multer`, `storage.ts` with local fallback, state machine transition update)
- **Wave 2 (`8-02`):** Delivery Dispatch Pool & Atomic Claim Service (`GET /delivery/pool`, `POST /delivery/orders/:orderId/claim`, release & override)
- **Wave 3 (`8-03`):** Doorstep Delivery Completion & Whole-Line Refusal Engine (`POST /delivery/orders/:orderId/complete`, `RETURN_IN` ledger restock)
- **Wave 4 (`8-04`):** Frontend Delivery API Client & Navigation Alignment (`delivery.api.ts`, React Query hooks, `BottomNav` alignment)
- **Wave 5 (`8-05`):** Delivery Partner Dispatch Pool & Active Deliveries Screens (`/delivery/pool`, `/delivery/orders`)
- **Wave 6 (`8-06`):** Doorstep Checklist, Camera Proof, Admin Override & Verification (`/delivery/orders/[orderId]`, camera capture, regression tests)
