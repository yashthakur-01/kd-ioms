# Plan 6-05: Frontend Cart Checkout Screen & Stock Shortage UX

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-05`  
**Wave:** 5 (Frontend Cart & Checkout Experience)  
**Dependencies:** Phase 5, Plan 6-02, Plan 6-03  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver the responsive Cart Checkout experience at `/cart` (`frontend/src/app/cart/page.tsx` and `frontend/src/features/cart/CartCheckoutView.tsx`), integrating with `useCart`, providing line-item quantity editing and removal, delivery note input (max 300 chars), grand total calculation, per-attempt UUID idempotency management, interactive stock shortage error handling (`409 INSUFFICIENT_STOCK`) with one-tap "Use Available" resolution, and automated redirect to order confirmation upon success.

---

## 2. Tasks & Detailed Instructions

### Task 1: Cart API & Order Placement Client (`frontend/src/lib/api/orders.api.ts`)
- Implement typed order API functions:
  ```ts
  export interface PlaceOrderPayload {
    retailerId?: string;
    note?: string | null;
    items: Array<{
      medicineId: number;
      quantity: number;
      quotedPriceInclGst: string;
    }>;
  }

  export interface PlaceOrderResponseData {
    orderId: number;
    orderNumber: string;
    status: string;
    totalAmount: string;
    createdAt: string;
  }

  export async function placeOrder(
    payload: PlaceOrderPayload,
    idempotencyKey: string
  ): Promise<ApiResponse<PlaceOrderResponseData>> {
    return apiClient.post('/orders', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }
  ```

### Task 2: Cart Checkout View Component (`frontend/src/features/cart/CartCheckoutView.tsx`)
- Build modern responsive checkout view:
  1. **Cart Items Table / Cards:**
     - Medicine name, company, pack size, unit price (`₹XX.XX Incl. GST`), struck-through MRP.
     - Interactive quantity stepper `[-] [qty] [+]` clamped to `[1, item.maxAvailable]`.
     - Line total in INR (`quantity * quotedPriceInclGst`).
     - Remove item icon button with confirmation or instant deletion.
  2. **Delivery Note Textarea:**
     - Clean text area for delivery instructions.
     - Character counter (`X / 300`).
     - Clamped to 300 characters maximum.
  3. **Order Summary Card:**
     - Items count, GST breakdown note, grand total in bold.
     - Primary Action Button: "Place Order (₹Total)".
     - State handling: disabled when cart is empty, disabled with spinner while order placement is in flight (`isSubmitting`).
  4. **Idempotency Key State:**
     - Generates initial key via `crypto.randomUUID()`.
     - Reuses same key on retry if submission fails due to network error.
     - Automatically generates a new key if cart items or note are modified.
  5. **Stock Shortage UX (Handling `409 INSUFFICIENT_STOCK`):**
     - Extracts `error.details: Array<{ medicineId: number; requested: number; available: number }>`.
     - Highlights short lines with an amber/red border and badge: `Only ${available} available`.
     - Displays one-tap **"Use Available"** action button on the short item:
       - If `available > 0`: updates item quantity to `available` via `updateQuantity(medicineId, available)`.
       - If `available === 0`: removes item from cart via `removeItem(medicineId)`.
       - Clears the shortage warning for that item.
  6. **Price Change UX (Handling `409 PRICE_CHANGED`):**
     - Displays alert explaining that medicine prices have updated in the catalog.
     - Offers action button to refresh items and quotes.
  7. **Successful Submission:**
     - Calls `clearCart()` to purge user's localStorage cart.
     - Navigates immediately to `/orders/${data.orderId}` with success toast.

### Task 3: Cart Page Route (`frontend/src/app/cart/page.tsx`)
- Implement `/cart/page.tsx` rendering `CartCheckoutView` inside authenticated shell.
- Empty state: Displays friendly empty cart illustration, "Your cart is empty", and primary CTA button "Browse Medicine Catalog" leading to `/catalog`.

### Task 4: Unit & Interaction Tests (`frontend/src/features/cart/__tests__/CartCheckout.test.tsx`)
- Author test suite verifying:
  1. Renders empty cart state when no items in `useCart`.
  2. Renders item details, quantity steppers, line totals, and grand total.
  3. Modifying quantity updates line total and grand total.
  4. Placing order sends `Idempotency-Key` header and payload matching schema.
  5. On 409 `INSUFFICIENT_STOCK`, displays warning badge and "Use Available" button; clicking updates line quantity to available stock.
  6. On 201 Created, calls `clearCart()` and navigates to order page.

---

## 3. Verification & Acceptance Criteria
- [ ] `/cart` renders empty state when cart is empty with link to `/catalog`.
- [ ] Cart renders line items with steppers, unit prices, line totals, and delivery note.
- [ ] "Place Order" button creates and reuses idempotency key on network failure; generates new key on cart edits.
- [ ] Short stock error highlights short rows and provides working "Use Available" button.
- [ ] Cart is cleared and user is redirected upon successful placement.
- [ ] All frontend unit tests pass cleanly (`npm test --workspace=frontend`).
