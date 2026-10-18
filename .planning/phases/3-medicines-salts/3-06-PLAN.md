# Plan 3-06: E2E Integration Verification, Trigger Walkthrough & Phase Sign-Off

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-06`  
**Wave:** 6 (Verification & Sign-off)  
**Dependencies:** Plans 3-01 through 3-05  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Execute an end-to-end integration walkthrough testing the complete domain lifecycle across database triggers, API contracts, error boundaries, and UI workflows. Verify that automated test suites pass with zero regressions, linting and compilation are clean, and update the project roadmap state to unblock Phase 4.

---

## 2. Tasks & Detailed Instructions

### Task 1: Comprehensive E2E Verification Walkthrough
- Execute an end-to-end test script or integration suite validating:
  1. **Salt Duplicate Rejection:** Creating `"Paracetamol"` followed by `"  paracetamol  "` rejects with 409 `DUPLICATE_RESOURCE`.
  2. **Salt Similarity Collision:** Creating `"Paracetamol 500"` when `"Paracetamol"` exists rejects with 409 `SALT_SIMILAR_EXISTS` and returns near-matches; repeating with `{ confirmSimilar: true }` succeeds.
  3. **Medicine Creation & Trigger Formatter:** Creating medicine `"Augmentin"` with `saltIds: [Amoxicillin, Clavulanate]` verifies DB trigger `trg_medicines_salts_text` automatically creates `salts_text = "Amoxicillin + Potassium Clavulanate"`.
  4. **Medicine Salt Invariants:** Creating medicine referencing an inactive salt ID fails with 400 `VALIDATION_ERROR` identifying `saltIds.<index>`.
  5. **Case-Insensitive Medicine Identity:** Creating `"augmentin"` with company `"GSK"` and pack `"10 Tablets"` collides with existing `"Augmentin"` / `"GSK"` / `"10 Tablets"` returning 409 `DUPLICATE_RESOURCE`.
  6. **Automated Salt Rename Trigger:** Renaming `"Amoxicillin"` to `"Amoxicillin Trihydrate"` automatically updates `"Augmentin"`'s `salts_text` in the database to `"Amoxicillin Trihydrate + Potassium Clavulanate"`.
  7. **Salt In-Use Deactivation Guard:** Attempting to deactivate `"Amoxicillin Trihydrate"` while linked to active `"Augmentin"` fails with 409 `SALT_IN_USE`.
  8. **GST Rate Price Ceiling Guard:**
     - Simulating an active batch of `"Augmentin"` with `mrp = 100.00` and `selling_price = 90.00`.
     - Attempting to update medicine GST rate from `5.00` to `18.00` (which would make effective price `90.00 * 1.18 = 106.20 > 100.00`) fails with 422 `PRICE_EXCEEDS_MRP`.
  9. **Trigram Search:** `GET /api/v1/medicines/search?q=clavulanate` returns `"Augmentin"` in the results; searching `GET /api/v1/medicines/search?q=augment` returns `"Augmentin"`.
  10. **Delivery Access:** Delivery partner token can query `GET /api/v1/medicines/search` but is rejected with 403 on write endpoints.

### Task 2: Automated Test Suites Execution
- Run backend tests: `npm test --workspace=backend`.
- Run frontend tests: `npm test --workspace=frontend`.
- Run root test command: `npm test`.

### Task 3: Monorepo Build, Typecheck & Lint Verification
- Run TypeScript typecheck: `npm run build`.
- Run linter: `npm run lint`.
- Verify enum synchronization: `npm run sync-enums`.

### Task 4: Project State & Sign-Off Documentation
- Update `STATE.md`:
  - Mark Phase 3 as ✅ COMPLETED.
  - Unblock Phase 4: Stock Inward and Batches for `dev1`.
- Prepare summary of deliverables for `dev1` and team branch merge.

---

## 3. Verification & Acceptance Criteria
- [ ] Complete E2E walkthrough script passes with 100% assertions satisfied.
- [ ] Backend and frontend test suites pass with 0 failures.
- [ ] Root `npm run build` and `npm run lint` pass cleanly with 0 warnings or errors.
- [ ] Phase 3 exit criteria satisfied and Phase 4 unblocked.
