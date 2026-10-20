# Plan 8-05: Delivery Partner Dispatch Pool & Active Deliveries Screens

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-05`  
**Wave:** 5 (Pool & Deliveries List Screens)  
**Dependencies:** Plan 8-04  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the responsive, mobile-first frontend interfaces for the Delivery Dispatch Pool (`/delivery/pool`) and the Partner's Deliveries list (`/delivery/orders`). The dispatch pool provides pull-to-refresh, prominent claim buttons, and friendly handling for race conditions when another partner claims an order first. The deliveries screen organizes stops into Active and Completed tabs with clear status indicators and tap targets.

---

## 2. Tasks & Detailed Instructions

### Task 1: Delivery Pool View (`frontend/src/features/delivery/DeliveryPoolView.tsx`)
- Implement component:
  - Header with title "Wholesale Dispatch Pool", live badge showing count of available wholesale orders, and a manual Refresh action.
  - Card feed of unassigned orders:
    - Order number pill, approval elapsed time (e.g. "Approved 18 mins ago").
    - Pharmacy shop name, City & Pincode.
    - Total order amount (`₹... paan/medicines value`) and item line count.
    - Prominent "Claim Delivery" button (emerald style, min-height 44px, loading spinner during claim).
  - Race condition modal / banner:
    - If claim fails with 409 `ORDER_ALREADY_CLAIMED`: displays a clear banner/modal: *"Already Taken: Another delivery partner claimed this order moments ago."*
    - Automatically refetches the pool to update available orders.
  - Empty state when no orders in pool: friendly illustration and note that new orders will appear once picked and approved.
- Page `frontend/src/app/(delivery)/delivery/pool/page.tsx`:
  - Mounts `DeliveryPoolView`.

### Task 2: Partner Orders View (`frontend/src/features/delivery/PartnerOrdersView.tsx`)
- Implement component:
  - Segmented control / tabs: "Active Deliveries" (`OUT_FOR_DELIVERY`) vs "Past Deliveries" (`DELIVERED`, `REJECTED`).
  - Active Delivery Cards:
    - Pharmacy name and contact summary.
    - Order number, claimed timestamp, item count, and order total.
    - Prominent action button: "Start Doorstep Check" linking to `/delivery/orders/${order.orderId}`.
    - "Release to Pool" action button triggering release confirmation modal.
  - Completed Delivery Cards:
    - Status badge (`DELIVERED` emerald, `REJECTED` rose).
    - Completion timestamp (`delivered_at`).
    - View summary link.
- Page `frontend/src/app/(delivery)/delivery/orders/page.tsx`:
  - Mounts `PartnerOrdersView`.

### Task 3: Component Tests (`frontend/src/features/delivery/__tests__/`)
- `DeliveryPoolView.test.tsx`:
  1. Renders pool order cards with shop name, city, amount, and item count.
  2. Clicking "Claim Delivery" calls claim mutation and navigates on success.
  3. Displays "Already Taken" message when claim mutation returns 409 `ORDER_ALREADY_CLAIMED`.
- `PartnerOrdersView.test.tsx`:
  1. Switches between Active and Past delivery tabs.
  2. Displays active orders with "Start Doorstep Check" navigation link.

---

## 3. Verification Criteria

- [ ] `/delivery/pool` displays approved orders and claims orders with optimistic feedback.
- [ ] Claim collisions (409) show the friendly "Already taken" message without crashing or hanging.
- [ ] `/delivery/orders` organizes active and past orders cleanly with 44px+ touch targets on mobile.
- [ ] Component unit tests pass via `npm test -- frontend/src/features/delivery/__tests__/`.
