# Plan 5-06: Admin Alerts Out-of-Stock View & E2E Integration Verification

**Phase:** Phase 5 — Catalog and Availability  
**Plan ID:** `5-06`  
**Wave:** 6 (Admin Alerts & Full Verification)  
**Dependencies:** Plan 5-03, Plan 5-05  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver the Admin Out-of-Stock alerts interface at `/admin/alerts`, perform complete end-to-end multi-batch lifecycle verification across mixed stock states (fresh, near-expiry, expired, blocked, and reserved), guarantee 100% test coverage for Phase 5 invariants, and secure phase exit sign-off.

---

## 2. Tasks & Detailed Instructions

### Task 1: Admin Alerts Page (`frontend/src/app/(admin)/alerts/page.tsx`)
- Implement:
  - Header: `"Inventory Alerts & Shortfalls"` with operational tab strip:
    - Tab 1: `"Out of Stock"` (Phase 5 — Active, with red count badge).
    - Tab 2: `"Near Expiry"` (Phase 10 — Disabled or placeholder badge `"Available in Phase 10"`).
    - Tab 3: `"Expired Stock"` (Phase 10 — Disabled or placeholder badge `"Available in Phase 10"`).
  - Out-of-Stock Tab Content:
    - Queries `GET /api/v1/alerts/out-of-stock`.
    - Responsive Data Table:
      - Medicine Name & Company.
      - Pack Size & Composition (`saltsText`).
      - On-Hand Quantity (`0` or positive if 100% reserved).
      - Reserved Quantity (from `PLACED` orders).
      - MRP.
      - Action Column: Primary button `"Inward Stock →"` navigating to `/stock/inward?medicineId=${item.medicineId}`.
    - Pagination controls for high-volume catalogs.
    - Empty state: `"All products in stock! No inventory shortfalls detected."` with green checkmark illustration.
- Page tests: `frontend/src/app/(admin)/alerts/__tests__/AlertsPage.test.tsx`.

### Task 2: End-to-End Lifecycle Verification Suite (`backend/src/modules/catalog/__tests__/e2e-catalog.test.ts`)
- Automated lifecycle walkthrough executing sequential state transitions:
  1. **Multi-batch ceiling calculation:** Inward Batch A (selling price ₹100, GST 12%) and Batch B (selling price ₹120, GST 12%) for Medicine 1. Verify `GET /catalog` returns `maxPriceInclGst = "134.40"` and `availableQty` equal to the combined quantity.
  2. **Expiry filtering:** Create Batch C with expiry date in past. Verify `availableQty` excludes Batch C and pricing is unaffected by expired stock.
  3. **Blocked batch filtering:** Block Batch A (`status = 'BLOCKED'`). Verify Batch A quantity is immediately deducted from catalog availability.
  4. **Reservation synchronization:** Place an order with 15 units of Medicine 1 (`status = 'PLACED'`). Verify `GET /catalog` immediately reflects `availableQty` reduced by 15 units.
  5. **Order cancellation restoration:** Cancel the order (`status = 'CANCELLED'`). Verify `GET /catalog` immediately restores the 15 units.
  6. **Zero stock & alert queue:** Deplete remaining stock to 0. Verify `GET /catalog` returns `availableQty = 0`, `inStock = false`, `maxPriceInclGst = null`, and `GET /alerts/out-of-stock` lists Medicine 1.
  7. **Tenant isolation & information masking:** Sign in as approved retailer and verify response payload contains zero batch numbers, purchase rates, or expiry dates. Sign in as unapproved retailer and verify 403 `RETAILER_NOT_APPROVED`.

### Task 3: Full Workspace Lint, Build & Test Verification
- Run complete test suites:
  - Backend: `npm test --workspace=backend`
  - Frontend: `npm test --workspace=frontend`
- Run linting and TypeScript compilation:
  - `npm run lint`
  - `npm run build`
- Ensure zero errors, warnings, or regressions across the codebase.

---

## 3. Verification & Acceptance Criteria
- [ ] Admin alerts screen renders `/admin/alerts` Out-of-Stock queue with direct restock links.
- [ ] E2E lifecycle test suite executes and passes 100% of cases.
- [ ] Mixed stock states (active, expired, blocked, reserved) correctly compute availability.
- [ ] Full workspace passes `npm test`, `npm run lint`, and `npm run build`.
- [ ] Phase 5 exit criteria satisfied.
