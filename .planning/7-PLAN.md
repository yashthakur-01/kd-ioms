# Phase 7 Plan: Order Approval and Batch Picking

*See full master plan and wave breakdown at [`.planning/phases/7-approval-picking/7-PLAN.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/7-approval-picking/7-PLAN.md)*

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Responsible Developer:** `dev1`  
**Status:** 📋 READY FOR EXECUTION  

### Wave Breakdown:
- **Wave 1 (`7-01`):** FEFO Suggestion Engine & Allocation Service (`allocation.service.ts`, `GET /orders/:orderId/pick-suggestions`)
- **Wave 2 (`7-02`):** Barcode & Pack Scan Resolver Service (`POST /batches/resolve-scan`)
- **Wave 3 (`7-03`):** Atomic Approval Transaction & Shortfall Dropping (`orderService.approveOrder`, ascending batch locking, `applyLedgerEntry(OUTWARD)`)
- **Wave 4 (`7-04`):** Administrative Rejection & Unclaimed Restock (`orderService.rejectOrder`, `applyLedgerEntry(RESTOCK)`)
- **Wave 5 (`7-05`):** Frontend Admin Order Picking Screen & Card UI (`/orders/[orderId]/pick`, `OrderItemPickCard`, `FefoSuggestionChips`)
- **Wave 6 (`7-06`):** Hardware Barcode Gun & Camera Scanner Integration, E2E Verification & Handoff
