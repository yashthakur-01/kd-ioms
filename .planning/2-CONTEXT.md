# Phase 2 Context: Retailer Onboarding

*See full details at [`.planning/phases/02-retailer-onboarding/02-CONTEXT.md`](file:///home/buddy/sandarp/kd-ioms/.planning/phases/02-retailer-onboarding/02-CONTEXT.md)*

**Phase:** Phase 2 — Retailer Onboarding  
**Responsible Developer:** `dev3`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 2`)  

### Key Decisions Locked:
1. **Navigation Gating:** Unapproved retailers are strictly redirected to `/profile`. `BottomNav` items (Catalog, Cart, Orders) are disabled with a lock badge until `APPROVED`.
2. **Profile Presentation:** When `PENDING` or `APPROVED`, the profile details render in a clean read-only summary card with a prominent status banner and quick-copy buttons for GSTIN and Drug License.
3. **Resubmission Flow:** When `REJECTED`, a persistent red card displays admin rejection remarks above a pre-filled editable form with a "Resubmit for Review" button.
4. **Lock Policy:** Approved profiles are locked against direct edits (409 `INVALID_STATE_TRANSITION`); users are directed to contact admin/support for amendments.
5. **Admin Review Queue:** `/admin/retailers` uses status-based tabs with live badge counts ("Pending Review", "Approved", "Rejected", "All") and search.
6. **Rejection Presets:** Rejection dialog offers common chip presets + custom 5–300 char textarea with live character counter.
7. **Approval Safety:** Dedicated confirmation modal with shop summary before committing approval.
8. **Live State Synchronization:** Window focus refetching and an on-demand "Check Verification Status" button on `/profile` unlock navigation reactively without a full page reload.
