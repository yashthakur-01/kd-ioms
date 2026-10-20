# Phase 8 Context: Delivery, Refusal and Proof

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 8`)  
**Primary Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 13, Section 2.1, Section 2.8, Section 9.2, Section 11.2, and [`ROADMAP.md`](file:///d:/coding/Projects/kd-ioms/.planning/ROADMAP.md) Phase 8  

---

## 1. Phase Objective & Boundary

Implement the complete field logistics and doorstep fulfillment workflow where Delivery Partners claim approved orders from a dispatch pool, deliver physical inventory to pharmacies, collect photo proof of delivery, and record whole-line doorstep item acceptances or refusals. Refusals immediately restock the original batches with full audit traceability via append-only ledger entries (`RETURN_IN`):

1. **Dispatch Pool (`GET /api/v1/delivery/pool`):**
   - Retrieves all orders in `status = 'APPROVED'` that have not yet been assigned to a delivery partner (`delivery_partner_id IS NULL`).
   - Ordered by oldest first (`created_at ASC` / `updated_at ASC`) to prioritize aging wholesale orders.
   - Returns order number, retailer shop name, destination city & pincode, line item count, total order amount, and approval timestamp.

2. **Atomic Pool Claim (`POST /api/v1/delivery/orders/:orderId/claim`):**
   - Executes a conditional atomic SQL statement:
     ```sql
     UPDATE orders
     SET status = 'OUT_FOR_DELIVERY',
         delivery_partner_id = $1,
         claimed_at = NOW(),
         updated_at = NOW()
     WHERE order_id = $2
       AND status = 'APPROVED'
       AND delivery_partner_id IS NULL
     RETURNING *;
     ```
   - First caller wins. Concurrent claims fail with 409 `ORDER_ALREADY_CLAIMED`.
   - Records transition in `order_status_history`: `APPROVED -> OUT_FOR_DELIVERY`.
   - Returns order details, pharmacy address, phone, and item lines.

3. **Order Release & Admin Override (`POST /api/v1/delivery/orders/:orderId/release` & `POST /api/v1/delivery/orders/:orderId/override`):**
   - **Self-Release (`POST /delivery/orders/:orderId/release`):** Assigned partner can release an `OUT_FOR_DELIVERY` order back to the pool (e.g. vehicle breakdown, emergency) before attempting completion. Transitions back to `APPROVED`, resets `delivery_partner_id = NULL` and `claimed_at = NULL`.
   - **Admin Override (`POST /delivery/orders/:orderId/override`):** Admin can release any `OUT_FOR_DELIVERY` order back to the pool or reassign it to a specific partner.
   - Extends state machine `ALLOWED_TRANSITIONS` to permit `OUT_FOR_DELIVERY -> APPROVED`.

4. **Partner Deliveries (`GET /api/v1/delivery/orders` & `GET /api/v1/delivery/orders/:orderId`):**
   - `GET /delivery/orders`: Lists orders claimed by the authenticated delivery partner with optional status filter (`OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`).
   - `GET /delivery/orders/:orderId`: Returns stop details, pharmacy contact, full delivery address, tap-to-call phone number, and items to deliver including assigned batch numbers and expiry dates from `order_allocations`.
   - Enforces strict role and assignment authorization (only assigned partner or admin can view).

5. **Doorstep Delivery Completion & Refusal Engine (`POST /api/v1/delivery/orders/:orderId/complete`):**
   - Accepts `multipart/form-data`:
     - `photo`: File upload (JPEG, PNG, WebP; max 5MB).
     - `decisions`: JSON string array `[{ orderItemId, decision: "ACCEPTED" | "REFUSED", reason?: string }]`.
   - **Pre-transaction Photo Upload:** Photo uploaded via `uploadDeliveryPhoto(buffer, mime, orderId)` to Supabase Storage (with local disk fallback when credentials are not configured). If upload fails, aborts immediately with 502 `EXTERNAL_SERVICE_ERROR`; database remains completely untouched.
   - **Single Transaction Stock Restock & Status Finalization:**
     - Exclusively locks order (`FOR UPDATE`), verifies `status = 'OUT_FOR_DELIVERY'` and `delivery_partner_id = partnerId`.
     - Validates every item with `picked_quantity > 0` has an explicit decision (`ACCEPTED` or `REFUSED`).
     - Refused items require a mandatory 3–200 character refusal reason.
     - **Whole-Line Refusal Invariant:** For each `REFUSED` line:
       - Sets `order_items`: `delivery_status = 'REFUSED'`, `refusal_reason = decision.reason`.
       - Retrieves all `order_allocations` for the line item.
       - Reverses inventory for each allocation via `applyLedgerEntry(client, { batchId, type: 'RETURN_IN', delta: quantity, orderId, orderItemId, userId: partnerId, reason })`.
     - For each `ACCEPTED` line: sets `delivery_status = 'ACCEPTED'`.
     - **Final Order Status Determination:**
       - If at least one line is `ACCEPTED`: transitions order to `DELIVERED`, sets `delivered_at = NOW()`, `delivery_photo_path = photoPath`.
       - If 100% of lines are `REFUSED`: transitions order to `REJECTED`, sets `delivery_photo_path = photoPath`, `rejection_reason = combinedReasons`.
     - Records transition in `order_status_history`.
     - Commits transaction.
     - Note: For `DELIVERED` orders, Phase 9 invoice generation is triggered post-commit once Phase 9 is implemented (stubbed safely for now).

6. **Mobile-First Delivery Frontend:**
   - Standardized routes:
     - Dispatch Pool: `/delivery/pool`
     - Partner Deliveries: `/delivery/orders`
     - Doorstep Stop Checklist & Photo Capture: `/delivery/orders/[orderId]`
     - Place Order on behalf of retailer: `/delivery/orders/new` (built in Phase 6)
   - Updated `BottomNav` navigation in `(delivery)/layout.tsx`.
   - High-contrast, large touch targets (>= 44px) for mobile phone viewports.
   - Camera photo capture (`<input type="file" accept="image/*" capture="environment">`) with preview and retake.
   - Lock submit button and show progress indicator during multipart upload.

---

## 2. Architecture Decisions & Invariants

| Decision ID | Area | Decision Summary | Source Reference |
| :---: | :--- | :--- | :--- |
| **ADR-033** | Atomic Pool Claim | Delivery claim uses atomic conditional update: `UPDATE orders SET status = 'OUT_FOR_DELIVERY', delivery_partner_id = $1, claimed_at = NOW() WHERE order_id = $2 AND status = 'APPROVED' AND delivery_partner_id IS NULL RETURNING *`. If zero rows updated, checks order existence and returns 409 `ORDER_ALREADY_CLAIMED` or 409 `INVALID_STATE_TRANSITION`. | `tech.md` 13.2, 13.3 |
| **ADR-034** | Whole-Line Doorstep Refusal | Refusal is whole-line only: either the entire picked quantity of an item is accepted or all of it is refused. No partial line refusal and no post-delivery returns. Refused items require a 3–200 character reason. | `tech.md` 13.3 |
| **ADR-035** | Append-Only Stock Return | Every refused line item triggers `applyLedgerEntry` with `type = 'RETURN_IN'` (+delta) for each allocation in `order_allocations`, restoring `batches.quantity_on_hand` with order/item audit links. Direct SQL updates to batches remain strictly banned. | `tech.md` 9.2, 13.3 |
| **ADR-036** | Delivery Photo & Failure Atomicity | Delivery photo upload (max 5MB, JPEG/PNG/WebP) is performed via Supabase Storage (with local filesystem fallback when cloud credentials are not set). If photo upload fails, request aborts with 502 `EXTERNAL_SERVICE_ERROR` before database transaction begins, leaving order and inventory untouched. | User Alignment / `tech.md` 13.1, 13.3 |
| **ADR-037** | Delivery Partner Release & Admin Override | An order in `OUT_FOR_DELIVERY` can be returned to `APPROVED` in the pool via partner self-release (`POST /delivery/orders/:orderId/release`) or admin override (`POST /delivery/orders/:orderId/override`). State machine `ALLOWED_TRANSITIONS` updated to allow `OUT_FOR_DELIVERY -> APPROVED`. | User Alignment |
| **ADR-038** | Standardized Delivery Frontend Hierarchy | Frontend routes aligned with backend hierarchy: Dispatch Pool at `/delivery/pool`, My Deliveries at `/delivery/orders`, Delivery Checklist & Proof at `/delivery/orders/[orderId]`, and On-Behalf Order at `/delivery/orders/new`. `(delivery)/layout.tsx` `BottomNav` synchronized. | User Alignment |

---

## 3. Detailed API Specifications

### 3.1 `GET /api/v1/delivery/pool`
- **Auth:** Role `DELIVERY` or `ADMIN`.
- **Query Parameters:** `page` (default 1), `pageSize` (1–50, default 20).
- **Behavior:** Query orders where `status = 'APPROVED'` and `delivery_partner_id IS NULL`, ordered by `created_at ASC`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "DELIVERY_POOL_RETRIEVED",
    "message": "Available pool orders retrieved successfully",
    "data": [
      {
        "orderId": 142,
        "orderNumber": "ORD-000142",
        "retailer": {
          "userId": "uuid-retailer",
          "shopName": "Apollo Pharmacy",
          "city": "Ahmedabad",
          "pincode": "380015",
          "phone": "9876543210"
        },
        "itemCount": 4,
        "totalAmount": "2450.00",
        "approvedAt": "2026-10-20T09:30:00.000Z",
        "createdAt": "2026-10-20T09:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
  ```

### 3.2 `POST /api/v1/delivery/orders/:orderId/claim`
- **Auth:** Role `DELIVERY`.
- **Params:** `orderId` (positive integer).
- **Behavior:** Atomic conditional update to `OUT_FOR_DELIVERY`. Records `order_status_history`.
- **Response `200 OK`:** Full order details with address, phone, and item lines.
- **Errors:**
  - `404 NOT_FOUND`: Order does not exist.
  - `409 ORDER_ALREADY_CLAIMED`: Order was already claimed by another partner.
  - `409 INVALID_STATE_TRANSITION`: Order is not in `APPROVED` status.

### 3.3 `POST /api/v1/delivery/orders/:orderId/release`
- **Auth:** Role `DELIVERY` (assigned partner) or `ADMIN`.
- **Params:** `orderId` (positive integer).
- **Body:** `{ reason?: string }` (optional, 3–300 chars).
- **Behavior:**
  - Validates order `status = 'OUT_FOR_DELIVERY'`.
  - For DELIVERY role, verifies `delivery_partner_id = actor.userId`.
  - Updates order: `status = 'APPROVED'`, `delivery_partner_id = NULL`, `claimed_at = NULL`.
  - Records in `order_status_history`: `OUT_FOR_DELIVERY -> APPROVED`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "code": "ORDER_RELEASED",
    "message": "Order released back to dispatch pool"
  }
  ```

### 3.4 `POST /api/v1/delivery/orders/:orderId/override`
- **Auth:** Role `ADMIN`.
- **Params:** `orderId` (positive integer).
- **Body:** `{ targetPartnerId?: string | null, reason: string }` (reason required, 5–300 chars).
- **Behavior:** Admin can release back to pool (`targetPartnerId: null`) or reassign to another delivery user. Updates `order_status_history`.
- **Response `200 OK`:** Updated order details.

### 3.5 `GET /api/v1/delivery/orders`
- **Auth:** Role `DELIVERY`.
- **Query Parameters:** `status` (optional: `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`), `page`, `pageSize`.
- **Behavior:** Returns orders where `delivery_partner_id = actor.userId`, sorted by `claimed_at DESC`.
- **Response `200 OK`:** Array of delivery orders with retailer summary and status.

### 3.6 `GET /api/v1/delivery/orders/:orderId`
- **Auth:** Role `DELIVERY` (assigned partner) or `ADMIN`.
- **Params:** `orderId` (positive integer).
- **Behavior:**
  - Verifies partner assignment (or admin).
  - Returns order details, full retailer contact (shop name, address line, city, state, pincode, whatsapp number, phone), and item list with picked quantities, batch numbers, and expiry dates.
- **Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`.

### 3.7 `POST /api/v1/delivery/orders/:orderId/complete`
- **Auth:** Role `DELIVERY` (assigned partner).
- **Headers:** `Content-Type: multipart/form-data`.
- **Form Fields:**
  - `photo`: Binary file (max 5MB, JPEG/PNG/WebP). Required.
  - `decisions`: JSON string. Required.
    ```json
    [
      { "orderItemId": 401, "decision": "ACCEPTED" },
      { "orderItemId": 402, "decision": "REFUSED", "reason": "Packaging torn and seal damaged" }
    ]
    ```
- **Validation Rules:**
  - `photo` must be present and valid MIME type.
  - `decisions` must parse into an array containing every order item with `picked_quantity > 0` exactly once.
  - For each decision with `REFUSED`, `reason` must be 3–200 characters.
- **Execution Workflow:**
  1. Upload `photo` via `storageService.uploadDeliveryPhoto(file.buffer, file.mimetype, orderId)`. If upload fails, throw 502 `EXTERNAL_SERVICE_ERROR`.
  2. In `withTransaction(client)`:
     - Select order `FOR UPDATE`.
     - Check `status = 'OUT_FOR_DELIVERY'` and `delivery_partner_id = partnerId`.
     - For `REFUSED` items: update item delivery status, fetch allocations, apply `RETURN_IN` (+quantity) per allocation via `applyLedgerEntry`.
     - For `ACCEPTED` items: update item delivery status to `ACCEPTED`.
     - If >= 1 line accepted: order status `DELIVERED`, `delivered_at = NOW()`, `delivery_photo_path = photoPath`.
     - If 0 lines accepted: order status `REJECTED`, `delivery_photo_path = photoPath`, `rejection_reason = combinedReasons`.
     - Record `order_status_history`.
     - Commit transaction.
  3. Return 200 response with updated order and item statuses.

---

## 4. Storage Architecture (Supabase with Local Disk Fallback)

- Module: `backend/src/utils/storage.ts`
- Environment Variables in `backend/src/config/env.ts`:
  - `SUPABASE_URL`: optional string.
  - `SUPABASE_SERVICE_ROLE_KEY`: optional string.
  - `SUPABASE_STORAGE_BUCKET`: string, default `'invoices'`.
  - `SUPABASE_DELIVERY_BUCKET`: string, default `'delivery-photos'`.
- Storage behavior:
  - If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided:
    - Uses `@supabase/supabase-js` storage client.
    - Uploads buffer to `SUPABASE_DELIVERY_BUCKET` with unique path: `${orderId}-${Date.now()}.${ext}`.
    - Generates public or signed URL / object path.
  - If credentials are NOT provided (development, CI, unit tests):
    - Saves buffer to local directory `uploads/delivery-photos/` within project.
    - Returns local file path relative to root: `uploads/delivery-photos/${filename}`.
    - Ensures CI and local tests run 100% offline without network flakiness.

---

## 5. Frontend Delivery Partner Experience

### 5.1 Route Mapping & BottomNav
- `/delivery/pool` — Dispatch Pool (browse and claim unassigned approved wholesale orders).
- `/delivery/orders` — Partner's deliveries (tabs for Active vs Completed).
- `/delivery/orders/[orderId]` — Doorstep delivery checklist, item accept/refuse, camera proof capture, and submit.
- `/delivery/orders/new` — On-behalf order placement for pharmacies (built in Phase 6).
- Synchronize `frontend/src/app/(delivery)/layout.tsx` `deliveryNavItems` to use `/delivery/pool`, `/delivery/orders`, `/delivery/orders/new`.

### 5.2 Mobile-First Touch & Interactions
- Minimum touch target 44px on all buttons, switches, and tabs.
- Sticky floating bottom summary bar during doorstep delivery showing Accepted vs Refused count and submission button.
- Pull-to-refresh on pool list with automatic refresh on focus.
- Camera capture integration with native camera launch: `<input type="file" accept="image/*" capture="environment">`.
- Instant thumbnail preview with clear file size indicator and retake action.
- Confirmation dialog on order release to avoid accidental returns.

### 5.3 Admin Orders Screen Integration
- In Admin Order Detail (`/orders/[orderId]`):
  - Shows assigned delivery partner name & phone.
  - Shows delivery proof photo thumbnail (click to expand in modal).
  - Shows item delivery statuses (`ACCEPTED` with green badge, `REFUSED` with red badge and tooltip reason).
  - If order is `OUT_FOR_DELIVERY`, provides Admin "Override / Reassign" button.

---

## 6. Testing Strategy & Verification Gates

1. **Atomic Concurrency Test:**
   - 10 simultaneous requests to `POST /delivery/orders/:id/claim` on a single `APPROVED` order.
   - Exactly 1 request succeeds with 200; 9 requests fail with 409 `ORDER_ALREADY_CLAIMED`.
2. **Stock Ledger Integrity & Refusal Test:**
   - Order with 2 items (Item A: 10 units across 2 batches; Item B: 5 units in 1 batch).
   - Delivery complete with Item A `REFUSED` ("Damaged") and Item B `ACCEPTED`.
   - Verifies:
     - Item A allocations trigger `RETURN_IN` (+delta) ledger rows for each respective batch.
     - `batches.quantity_on_hand` restored for Item A's batches.
     - Item B stock remains unchanged (`OUTWARD` from Phase 7 picking).
     - Order status transitions to `DELIVERED`.
3. **100% Refusal Test:**
   - All items refused at doorstep.
   - Verifies order transitions to `REJECTED`, all batches restocked via `RETURN_IN`, rejection reason recorded, and no invoice generated.
4. **Upload Failure Safety Test:**
   - Mock storage upload failure (network timeout / error).
   - Verifies 502 `EXTERNAL_SERVICE_ERROR` returned, transaction does not run, and order remains in `OUT_FOR_DELIVERY` without ledger modifications.
5. **Partner Authorization Isolation:**
   - Partner B attempting to complete or view Partner A's order receives 403 `FORBIDDEN` or 404 `NOT_FOUND`.
