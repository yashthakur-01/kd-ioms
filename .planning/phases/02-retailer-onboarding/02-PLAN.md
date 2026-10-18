# Master Plan: Phase 2 — Retailer Onboarding

**Phase:** Phase 2 — Retailer Onboarding  
**Status:** Planned & Ready for Execution  
**Responsible Developer:** `dev3`  
**Goal:** Retailers submit KYC profile, admin reviews and approves/rejects, gating catalog access and ordering permissions.

---

### Wave & Plan Breakdown

- **Wave 1:** [`02-01-PLAN.md`](file:///home/buddy/sandarp/kd-ioms/.planning/phases/02-retailer-onboarding/02-01-PLAN.md) — Backend Retailer Module & Authorization Middleware
  - Zod validation schemas (`retailer.validation.ts`) & database service (`retailer.service.ts`).
  - Endpoints: `GET /retailers/me`, `PUT /retailers/me`, `GET /retailers`, `GET /retailers/:userId`, `POST /retailers/:userId/approve`, `POST /retailers/:userId/reject`.
  - Middleware: `requireApprovedRetailer` blocking unapproved retailers with 403 `RETAILER_NOT_APPROVED`.
  - Automated integration test suite (`retailer.integration.test.ts`, `require-approved-retailer.test.ts`).

- **Wave 2:** [`02-02-PLAN.md`](file:///home/buddy/sandarp/kd-ioms/.planning/phases/02-retailer-onboarding/02-02-PLAN.md) — Frontend Client State, Layout Gating & Retailer Portal
  - Frontend feature module (`features/retailer/`): `api.ts`, `keys.ts`, `schema.ts`, `hooks.ts` with `useRetailerProfile` (refetchOnWindowFocus: true).
  - Layout navigation gating (`(retailer)/layout.tsx`): Route redirect and disabled `BottomNav` lock badges for unapproved retailers, celebratory toast on approval.
  - Retailer profile screen (`(retailer)/profile/page.tsx`): Unsubmitted form, Pending read-only inspector with manual "Check Status" button, Rejected red remarks with pre-filled form, and Approved verified callout with support notice.
  - Automated frontend component tests (`profile.test.tsx`).

- **Wave 3:** [`02-03-PLAN.md`](file:///home/buddy/sandarp/kd-ioms/.planning/phases/02-retailer-onboarding/02-03-PLAN.md) — Admin Review Queue, Verification Dialogs & E2E Validation
  - Admin retailer queue (`(admin)/retailers/page.tsx`): Status tabs ("Pending Review (N)", "Approved", "Rejected", "All"), search, table, and pagination.
  - Admin detail review page (`(admin)/retailers/[userId]/page.tsx`): Full KYC inspection view and sticky action bar.
  - Safety verification dialogs: `ConfirmDialog` on approve with shop summary, `RejectionModal` with preset chips and 5–300 char counter.
  - Automated frontend tests (`admin-retailers.test.tsx`) & full suite validation (`npm test`).

---

### Requirements Coverage Matrix

| Requirement | Description | Plan Reference |
|-------------|-------------|----------------|
| **FR-RET-01** | Retailer profile retrieval via `GET /retailers/me` | `02-01-PLAN.md`, `02-02-PLAN.md` |
| **FR-RET-02** | Retailer profile submission / resubmission via `PUT /retailers/me` | `02-01-PLAN.md`, `02-02-PLAN.md` |
| **FR-RET-03** | Approved profiles locked against direct edits | `02-01-PLAN.md`, `02-02-PLAN.md` |
| **FR-RET-04** | Admin retailer queue `GET /retailers` with filtering & search | `02-01-PLAN.md`, `02-03-PLAN.md` |
| **FR-RET-05** | Admin profile approval `POST /retailers/:userId/approve` | `02-01-PLAN.md`, `02-03-PLAN.md` |
| **FR-RET-06** | Admin profile rejection `POST /retailers/:userId/reject` with reason | `02-01-PLAN.md`, `02-03-PLAN.md` |
| **FR-RET-07** | Middleware `requireApprovedRetailer` blocking unapproved retailers | `02-01-PLAN.md`, `02-02-PLAN.md` |

---

### Exit Criteria ("Done When")

- Retailer moves from `PENDING` to `APPROVED` in the UI and gated features unlock without an application reload.
- Full automated test suite passes (`npm test`) with zero regressions.
