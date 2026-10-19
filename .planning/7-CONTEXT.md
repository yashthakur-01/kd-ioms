# Phase 7 Context: Order Approval and Batch Picking

*See full details at [`.planning/phases/7-approval-picking/7-CONTEXT.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/7-approval-picking/7-CONTEXT.md)*

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Responsible Developer:** `dev1`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 7`)  

### Key Decisions Locked:
1. **FEFO Auto-Suggestion Engine (ADR-027):** `GET /orders/:orderId/pick-suggestions` computes recommended pick quantities (`suggestedQty`) across eligible batches in FEFO order (`expiry_date ASC, batch_id ASC`) where `priceInclGst <= quotedPriceInclGst`.
2. **Ascending Batch Locking & Deadlock Safety (ADR-028):** Batch IDs locked in ascending numeric order (`FOR UPDATE`) within a single database transaction.
3. **Single-Entrypoint Inventory Movement (ADR-029):** Inventory decrements occur solely via `applyLedgerEntry(OUTWARD)` with order tracking, and unclaimed cancellations trigger `applyLedgerEntry(RESTOCK)`.
4. **Shortfall Dropped & Partial Fulfillment (ADR-030):** Picking less than requested sets item status to `PARTIAL` and drops remaining quantities without backorders.
5. **Interactive Hardware/Camera Scan-to-Pick:** Barcode scans automatically resolve active batches, increment picked counts, and trigger an audio-visual confirmation.
6. **Per-Line Card UI:** Expandable item cards with FEFO chips, scanner trigger, and live fulfillment progress.
