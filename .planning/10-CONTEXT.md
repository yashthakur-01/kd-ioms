# Phase 10 Context: Expiry Alerts, Settings and Dashboard

*See full context specifications in [`.planning/phases/10-expiry-settings-dashboard/10-CONTEXT.md`](file:///home/buddy/sandarp/kd-ioms/.planning/phases/10-expiry-settings-dashboard/10-CONTEXT.md)*

### Summary of Locked Decisions:
- **Application Settings (`/settings`):** Configurable `expiry_alert_days` (1–730) and `business_profile` (GSTIN, drug license, contact details).
- **In-Memory Caching:** 60-second TTL cache for settings in `settings.service.ts` with instant eviction on updates.
- **Dynamic Near-Expiry Alerts:** `v_expiry_alerts` filters dynamically using `app_settings.expiry_alert_days`; updates to settings immediately adjust alert lists.
- **Alert Dismissal:** `POST /alerts/near-expiry/:batchId/dismiss` records `expiry_alert_dismissed_at = NOW()` to keep batch as-is and hide from near-expiry view; still surfaces in expired view once date passes.
- **Expired Stock Disposal:** `POST /batches/:batchId/remove-expired` locks batch, strictly checks `expiry_date < today_ist()`, and executes `applyLedgerEntry(EXPIRY_WRITEOFF)` to reduce batch stock to zero.
- **Non-Blocking Dashboard:** `GET /dashboard/summary` dispatches 8 parallel count queries (`pendingRetailers`, `placedOrders`, `approvedUnclaimed`, `outForDelivery`, `nearExpiryBatches`, `expiredBatches`, `outOfStockMedicines`, `failedNotifications`) across database pool connections.
