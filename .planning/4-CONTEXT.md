# Phase 4 Context: Stock Inward, Batches and Append-Only Ledger

*See full context specifications in [`.planning/phases/4-stock-inward-batches/4-CONTEXT.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/4-stock-inward-batches/4-CONTEXT.md)*

### Summary of Locked Decisions:
- **Core Ledger Invariant:** `applyLedgerEntry()` in `stock-ledger.service.ts` is the single source of truth for changing `batches.quantity_on_hand`.
- **Concurrency & Deadlock Prevention:** Ascending primary-key locking (`lockMedicines`, `lockBatches`).
- **Batch Identity & Matching:** `(medicine_id, batch_number, expiry_date, mrp)`. Incoming stock on existing batch tops up quantity, preserving existing batch selling price, and records supplier in immutable ledger.
- **Price Ceilings:** Selling price incl. GST (`sellingPrice * (1 + gstRate / 100)`) must not exceed MRP (enforced with integer paise).
- **Scanner & OCR:** Hybrid barcode scanner (hardware listener + HTML5 camera feed + image upload) + client-side OCR heuristics (`parsePackText`).
- **Near-Expiry Threshold:** 90 days. Expiry write-off (`EXPIRY_WRITEOFF`) blocked with 409 `INVALID_STATE_TRANSITION` on non-expired batches.
