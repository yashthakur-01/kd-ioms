# Plan 8-04: Frontend Delivery API Client & Navigation Alignment

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-04`  
**Wave:** 4 (Client API & Layout Foundation)  
**Dependencies:** Plan 8-02, Plan 8-03  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Create the typed frontend API client and React Query hooks for the delivery module, align the delivery partner layout navigation bar with `/delivery/pool`, `/delivery/orders`, and `/delivery/orders/new`, and provide clean redirects for legacy paths (`/pool`, `/deliveries`, `/place-order`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Delivery API Client (`frontend/src/lib/api/delivery.api.ts`)
- Define TypeScript types matching backend envelopes:
  - `PoolOrderRecord`, `PartnerOrderRecord`, `DeliveryDetailRecord`, `LineDecisionPayload`, `CompleteDeliveryPayload`.
- Implement API methods:
  - `fetchDeliveryPool(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<PoolOrderRecord[]>>`
  - `claimDeliveryOrder(orderId: number): Promise<ApiResponse<DeliveryDetailRecord>>`
  - `releaseDeliveryOrder(orderId: number, reason?: string): Promise<ApiResponse<void>>`
  - `overrideDeliveryOrder(orderId: number, payload: { targetPartnerId?: string | null; reason: string }): Promise<ApiResponse<void>>`
  - `fetchPartnerDeliveries(params?: { status?: string; page?: number; pageSize?: number }): Promise<ApiResponse<PartnerOrderRecord[]>>`
  - `fetchDeliveryOrderDetail(orderId: number): Promise<ApiResponse<DeliveryDetailRecord>>`
  - `completeDeliveryOrder(orderId: number, payload: CompleteDeliveryPayload, onProgress?: (pct: number) => void): Promise<ApiResponse<any>>`:
    - Constructs `FormData`: appends `photo` file and `decisions` JSON string.
    - Sends `multipart/form-data` request via `fetch` or Axios/XHR to report upload progress.

### Task 2: React Query Hooks (`frontend/src/features/delivery/hooks/useDelivery.ts`)
- Implement:
  - `useDeliveryPool`: fetches pool with staleTime: 10s, exposes `refetch`.
  - `useClaimDelivery`: mutation, on success invalidates `['delivery-pool']` and `['partner-deliveries']`.
  - `usePartnerDeliveries(status?: string)`: fetches assigned deliveries.
  - `useDeliveryOrderDetail(orderId: number)`: fetches stop details.
  - `useReleaseDelivery`: mutation, invalidates pool and delivery queries on success.
  - `useCompleteDelivery`: mutation managing upload progress, disabled state, and cache invalidation.

### Task 3: Bottom Navigation & Route Alignment (`frontend/src/app/(delivery)/layout.tsx`)
- Update `deliveryNavItems`:
  ```tsx
  const deliveryNavItems = [
    { label: 'Dispatch Pool', href: '/delivery/pool' },
    { label: 'My Deliveries', href: '/delivery/orders' },
    { label: 'Place Order', href: '/delivery/orders/new' },
  ];
  ```
- Update/redirect legacy pages:
  - `frontend/src/app/(delivery)/pool/page.tsx` redirects or renders `DeliveryPoolPage`.
  - Ensure `/place-order` and `/deliveries` redirect cleanly so existing links and bookmarks continue to function.

### Task 4: API Unit Tests (`frontend/src/lib/api/__tests__/delivery.api.test.ts`)
- Test cases:
  1. `claimDeliveryOrder` sends POST to `/api/v1/delivery/orders/:orderId/claim` and returns order data.
  2. `completeDeliveryOrder` properly appends binary file and JSON stringified decisions to FormData.
  3. `fetchDeliveryPool` passes pagination parameters correctly.

---

## 3. Verification Criteria

- [ ] API client functions typed and compile without lint or TypeScript warnings.
- [ ] React Query hooks provide clean cache updates on claim, release, and completion.
- [ ] Bottom navigation displays updated links to `/delivery/pool`, `/delivery/orders`, `/delivery/orders/new`.
- [ ] Unit tests pass cleanly via `npm test -- frontend/src/lib/api/__tests__/delivery.api.test.ts`.
