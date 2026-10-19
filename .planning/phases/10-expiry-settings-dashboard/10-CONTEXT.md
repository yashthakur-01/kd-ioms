# Phase 10 Context: Expiry Alerts, Settings and Dashboard

**Phase:** Phase 10 — Expiry Alerts, Settings and Dashboard  
**Responsible Developer:** `dev3`  
**Status:** Context Gathered & Locked (Ready for Execution)  
**Primary Source:** [`tech.md`](file:///home/buddy/sandarp/kd-ioms/tech.md) Section 15, Section 2.1, Section 2.8, Section 9.2, and [`ROADMAP.md`](file:///home/buddy/sandarp/kd-ioms/.planning/ROADMAP.md) Phase 10  

---

## 1. Phase Objective & Boundary

Establish the daily operational alerting, physical write-off lifecycle, centralized application configuration, and executive KPI dashboard:
1. **Application Settings Management (`/settings`):**
   - Provide administrative retrieval (`GET /settings`) and partial update (`PATCH /settings`) for global configuration keys stored in `app_settings`: `expiry_alert_days` (threshold in days) and `business_profile` (invoicing & communication identity).
   - In-memory settings cache with a 60-second TTL in `settings.service.ts` to prevent redundant database hits on high-frequency reads.
   - Immediate cache eviction upon settings updates.
2. **Expiry Alerts Engine (`/alerts`):**
   - Query operational views `v_expiry_alerts` and `v_expired_stock` baseline-defined in `001_init.sql`.
   - `GET /alerts/near-expiry`: Batches with `quantity_on_hand > 0`, unexpired (`expiry_date >= today_ist()`), not dismissed (`expiry_alert_dismissed_at IS NULL`), and within the configured `expiry_alert_days` window.
   - `GET /alerts/expired`: Batches with `quantity_on_hand > 0` and expired (`expiry_date < today_ist()`).
   - `POST /alerts/near-expiry/:batchId/dismiss`: Administrative "Keep as it is" action setting `expiry_alert_dismissed_at = NOW()`. Removes batch from near-expiry alerts while ensuring it remains trackable once expired.
3. **Physical Stock Expiry Write-Off (`POST /batches/:batchId/remove-expired`):**
   - Single-step physical removal of expired inventory from warehouse shelves.
   - Enforces batch row locking (`lockBatches`).
   - Business rule: batch must be strictly expired (`expiry_date < today_ist()`); unexpired batches rejected with 409 `INVALID_STATE_TRANSITION`.
   - Invokes `applyLedgerEntry()` with entry type `EXPIRY_WRITEOFF` for `-quantity_on_hand`, zeroing out batch balance and logging an immutable ledger audit trail.
4. **High-Throughput Dashboard Summary (`GET /dashboard/summary`):**
   - Executes 8 parallel non-blocking count queries across operational subsystems:
     1. `pendingRetailers`: Pending KYC verifications (`retailers.verification_status = 'PENDING'`).
     2. `placedOrders`: Orders placed requiring review (`orders.status = 'PLACED'`).
     3. `approvedUnclaimed`: Orders approved awaiting picker assignment (`orders.status = 'APPROVED' AND claimed_by IS NULL`).
     4. `outForDelivery`: Active deliveries in transit (`orders.status = 'DISPATCHED'`).
     5. `nearExpiryBatches`: Batches nearing expiry (`v_expiry_alerts`).
     6. `expiredBatches`: Expired batches with stock (`v_expired_stock`).
     7. `outOfStockMedicines`: Medicines with 0 available stock (`v_medicine_availability WHERE available_qty = 0`).
     8. `failedNotifications`: WhatsApp/email notifications requiring intervention (`notification_logs.status = 'FAILED'`).
5. **Frontend Operations & Executive Hub:**
   - `/alerts`: Tabbed operational view for Near-Expiry, Expired Stock, and Out of Stock medicines with row actions (Keep/Dismiss, Adjust, Write-Off, Inward).
   - `/settings`: Settings configuration form (expiry threshold number stepper and full business profile editor).
   - `/dashboard`: Rich executive KPI dashboard featuring interactive metric cards linking directly to filtered administrative queues.
   - Navigation: Global alert badge in the admin navigation header refreshed every 60 seconds.

---

## 2. Locked Implementation Decisions

### 2.1 Settings Schema & In-Memory Caching
1. **Database Schema:**
   - Operates on existing table `app_settings` (`key VARCHAR(50) PRIMARY KEY`, `value JSONB NOT NULL`, `updated_by UUID REFERENCES users(id)`, `updated_at TIMESTAMPTZ DEFAULT NOW()`).
   - Pre-seeded keys:
     - `expiry_alert_days`: `{"days": 60}`
     - `business_profile`: `{"name": "Kandarp Drugs", "address": "...", "gstin": "...", "drugLicenseNumber": "...", "phone": "...", "email": "...", "logoPath": null}`
2. **Caching Strategy:**
   - Service-level singleton memory cache with timestamp tracking (`cachedAt: number`, `data: AppSettings`, `TTL_MS = 60_000`).
   - `getSettings()` checks `Date.now() - cachedAt < TTL_MS`. If valid, returns cached data without touching database.
   - `updateSettings()` executes database updates inside a transaction, stamps `updated_by = req.user.id`, and immediately purges/refreshes the in-memory cache.
3. **Validation Rules (`PATCH /settings`):**
   - `expiryAlertDays`: Integer between `1` and `730` (inclusive).
   - `businessProfile.gstin`: Valid Indian GSTIN format `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
   - `businessProfile.phone`: Standard phone string `^\+?[0-9]{10,15}$`.
   - `businessProfile.email`: Standard email format.
   - Partial updates permitted; merges with existing values.

### 2.2 Expiry Alerts & Removal Business Rules
1. **Near-Expiry Threshold Dynamism:**
   - Database view `v_expiry_alerts` dynamically filters against `app_settings` key `expiry_alert_days`:
     ```sql
     AND b.expiry_date <= (today_ist() + ((SELECT (value->>'days')::INT FROM app_settings WHERE key = 'expiry_alert_days')))
     ```
   - Changing `expiry_alert_days` via `PATCH /settings` immediately impacts query results without migrations or view recompilation.
2. **Dismissal Behavior:**
   - `POST /alerts/near-expiry/:batchId/dismiss`:
     - Verifies batch exists (`NOT_FOUND` 404).
     - If `expiry_date < today_ist()`, rejects with 409 `INVALID_STATE_TRANSITION` (cannot dismiss already expired batches).
     - Sets `expiry_alert_dismissed_at = NOW()`.
     - Excludes batch from `v_expiry_alerts` because `b.expiry_alert_dismissed_at IS NULL`.
     - When the batch crosses its `expiry_date`, it naturally appears in `v_expired_stock` regardless of dismissal state.
3. **Physical Stock Removal (`remove-expired`):**
   - Must lock the batch row with `FOR UPDATE` using `lockBatches(client, [batchId])`.
   - Rejects unexpired batches (`expiry_date >= today_ist()`) with 409 `INVALID_STATE_TRANSITION`.
   - If `quantity_on_hand === 0`, rejects with 400 `BATCH_ALREADY_EMPTY`.
   - Invokes `applyLedgerEntry(client, { batchId, type: 'EXPIRY_WRITEOFF', delta: -batch.quantity_on_hand, reason: reason || 'Physical expiry removal write-off', userId })`.
   - Batch quantity becomes `0`; ledger records the disposal event.

### 2.3 Dashboard Summary Parallel Execution
1. **Non-Blocking Execution:**
   - `dashboard.service.ts` uses `Promise.all()` to dispatch 8 distinct query promises concurrently.
   - Each query is scoped to a lightweight `COUNT(*)` query utilizing existing database indexes.
   - A slow queue count cannot block independent counts.
2. **Reconciliation Guarantee:**
   - Dashboard summary figures match 100% with list table counts returned by respective dedicated endpoints.

---

## 3. Interfaces & Data Contracts

### 3.1 Settings Data Contract
```ts
export interface BusinessProfile {
  name: string;
  address: string;
  gstin: string;
  drugLicenseNumber: string;
  phone: string;
  email: string;
  logoPath?: string | null;
}

export interface AppSettingsResponse {
  expiryAlertDays: number;
  businessProfile: BusinessProfile;
}
```

### 3.2 Dashboard Summary Contract
```ts
export interface DashboardSummaryResponse {
  pendingRetailers: number;
  placedOrders: number;
  approvedUnclaimed: number;
  outForDelivery: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  outOfStockMedicines: number;
  failedNotifications: number;
}
```

### 3.3 Alert Items Contract
```ts
export interface NearExpiryAlertItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  daysLeft: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}

export interface ExpiredStockItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  daysExpired: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}
```
