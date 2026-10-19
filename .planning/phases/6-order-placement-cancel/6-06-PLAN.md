# Plan 6-06: Frontend Orders, Timeline, Cancellation & Delivery Flow

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-06`  
**Wave:** 6 (Orders History, Lifecycle Timeline & On-Behalf Flow)  
**Dependencies:** Plan 6-03, Plan 6-04, Plan 6-05  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver the complete order tracking and lifecycle UI:
1. `OrderTimeline.tsx` milestone visualization component.
2. Orders listing screen (`/orders`) with status filtering, date range, search query, and pagination.
3. Order detail screen (`/orders/:orderId`) with status header, timeline, ordered items breakdown, order history trail, and Retailer Cancel Order confirmation modal (available only while `PLACED`).
4. Delivery partner on-behalf order placement flow (`/delivery/orders/new`).
5. Complete workspace automated test and build verification (`npm test`, `npm run lint`, `npm run build`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Order Timeline Component (`frontend/src/features/orders/OrderTimeline.tsx`)
- Implement responsive lifecycle status timeline:
  - Linear states: `PLACED` -> `APPROVED` -> `OUT_FOR_DELIVERY` -> `DELIVERED`.
  - Termination branch: `CANCELLED` (with cancellation timestamp and reason) or `REJECTED` (with rejection reason).
  - Displays checkmark icons for passed milestones, active pulsing ring for current milestone, and muted circle for upcoming milestones.
  - Displays formatted timestamps (IST) and actor notes from `order_status_history`.

### Task 2: Orders List Screen (`frontend/src/app/orders/page.tsx` & `OrdersListView.tsx`)
- Implement `/orders`:
  - Search input for order number (`ORD-XXXXXX`).
  - Status filter pill buttons / dropdown (`ALL`, `PLACED`, `APPROVED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`).
  - Date range filters (`from`, `to`).
  - Responsive table / cards: Order number, Pharmacy name (for Admin/Delivery), Status badge, Items count, Total amount, Creation date.
  - Row click navigates to `/orders/[orderId]`.
  - Pagination controls (`Previous`, `Page X of Y`, `Next`).

### Task 3: Order Detail Screen & Cancellation Action (`frontend/src/app/orders/[orderId]/page.tsx`)
- Implement `/orders/[orderId]`:
  - **Summary Header:** Order number, status badge, created date, pharmacy details, optional note.
  - **Order Timeline:** Renders `OrderTimeline` populated with `order.history`.
  - **Ordered Items Table:** Medicine name, company, pack size, requested quantity, quoted price incl. GST, line total.
  - **Cancellation Action:**
    - "Cancel Order" button visible ONLY when `order.status === 'PLACED'` and current user is the owning Retailer.
    - Clicking opens accessible confirmation modal:
      - Warning message: "Are you sure you want to cancel this order? This will release reserved stock."
      - Optional cancellation reason input (max 300 chars).
      - "Keep Order" button and destructive "Confirm Cancellation" button.
      - Dispatches `POST /api/v1/orders/:orderId/cancel`.
      - On success: updates local order status to `CANCELLED`, updates timeline, shows success toast.
      - On failure (e.g., order transitioned concurrently to `APPROVED`): displays error message (`Order could not be cancelled because it was already approved`).

### Task 4: Delivery Partner On-Behalf Flow (`frontend/src/app/delivery/orders/new/page.tsx`)
- Implement delivery partner ordering workflow:
  - Step 1: Search and select approved pharmacy from dropdown / list.
  - Step 2: Once pharmacy selected, renders embedded catalog with sticky banner: `Placing order on behalf of: [Pharmacy Name]`.
  - Step 3: Adding items to cart stores items and passes selected `retailerId` on checkout call to `POST /api/v1/orders`.

### Task 5: Component Tests & Full Verification
- Author test suites:
  - `OrderTimeline.test.tsx`: Tests rendering of milestones across all statuses.
  - `OrderDetail.test.tsx`: Tests rendering of items, history, and Cancel Order modal interaction.
- Run workspace validation:
  1. Backend vitest suite: `npm test --workspace=backend`
  2. Frontend vitest suite: `npm test --workspace=frontend`
  3. Linting: `npm run lint`
  4. Typecheck & Build: `npm run build`

---

## 3. Verification & Acceptance Criteria
- [ ] `OrderTimeline` accurately reflects order progression and handles terminal branches (`CANCELLED`, `REJECTED`).
- [ ] `/orders` supports pagination, search, and status filtering.
- [ ] `/orders/:orderId` renders itemized table and history.
- [ ] Cancel Order modal displays only for owning retailer during `PLACED` status; triggers cancellation and updates view.
- [ ] `/delivery/orders/new` allows delivery partners to choose an approved retailer and place orders on their behalf.
- [ ] All automated tests pass (backend + frontend).
- [ ] Workspace compiles and lints with 0 errors.
