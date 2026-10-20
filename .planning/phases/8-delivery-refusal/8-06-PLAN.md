# Plan 8-06: Doorstep Checklist, Camera Proof, Admin Override & Verification

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-06`  
**Wave:** 6 (Doorstep Execution, Camera Capture & Verification)  
**Dependencies:** Plan 8-03, Plan 8-05  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Implement the interactive Doorstep Delivery execution screen (`/delivery/orders/[orderId]`), integrating pharmacy contact details with tap-to-call and Google Maps navigation, line-level whole-item Accept/Refuse toggles with mandatory refusal reasons, native camera photo capture with instant preview, self-release order modal, sticky submit summary bar, and Admin order view enhancements (photo proof thumbnail, delivery status badges, and override actions). Finish with a comprehensive end-to-end regression test pass.

---

## 2. Tasks & Detailed Instructions

### Task 1: Doorstep Delivery Execution View (`frontend/src/features/delivery/DoorstepChecklistView.tsx`)
- Implement component:
  1. **Header & Context:**
     - Back navigation to `/delivery/orders`.
     - Order number pill, status badge, and "Release to Pool" action button.
  2. **Pharmacy Destination Card:**
     - Pharmacy name & Contact person.
     - Full address with a "Copy Address" button and an external link opening Google Maps directions.
     - Quick communication buttons: Tap-to-call (`tel:${phone}`) and WhatsApp direct message link.
  3. **Item Delivery Checklist:**
     - List of items to deliver:
       - Medicine Name, Company, Pack Size.
       - Picked Quantity to hand over.
       - Batch Number(s) and Expiry Date(s) allocated to the line.
       - Decision selector: Two mutually exclusive buttons: `[ Accept Full ]` (green border/fill) and `[ Refuse Full ]` (rose border/fill).
       - When `Refuse Full` is selected:
         - Expands refusal reason drawer with quick-preset tag chips: *"Packaging torn / seal broken"*, *"Wrong medicine delivered"*, *"Pharmacy refused order"*, *"Near expiry batch"*, plus a custom reason textarea (3–200 characters).
  4. **Camera Delivery Proof Card:**
     - Hidden native file input: `<input type="file" accept="image/*" capture="environment" />`.
     - "Take Delivery Photo" prominent button (min-height 48px).
     - Client-side size check (rejects files > 5MB with friendly toast).
     - Photo preview thumbnail once captured, with file size badge and "Retake Photo" action.
  5. **Sticky Submission Footer:**
     - Floating bottom summary displaying:
       - Count of Accepted vs Refused lines.
       - Order outcome indicator: *"DELIVERED (with partial restock)"* or *"REJECTED (all lines refused)"*.
     - "Complete Delivery" button:
       - Disabled until photo is captured and all active lines have a decision.
       - Shows upload progress indicator and button spinner to prevent double submission.
  6. **Release Order Modal:**
     - Allows partner to return order to pool if unable to deliver (e.g. vehicle issue) with reason input.
- Page `frontend/src/app/(delivery)/delivery/orders/[orderId]/page.tsx`:
  - Mounts `DoorstepChecklistView`.

### Task 2: Admin Order Detail Integration (`frontend/src/features/orders/OrderDetailView.tsx`)
- Enhance Admin order detail view:
  1. Show assigned Delivery Partner name & contact phone if `deliveryPartner` is present.
  2. If `deliveryPhotoPath` is present, display a "Delivery Proof" thumbnail card with click-to-expand preview modal.
  3. In line items table, display item `deliveryStatus`:
     - `ACCEPTED`: Emerald badge.
     - `REFUSED`: Rose badge with tooltip/info icon displaying the refusal reason.
  4. If order `status === 'OUT_FOR_DELIVERY'`, display an Admin "Override: Return to Pool" button with confirmation modal (calling `overrideDeliveryOrder`).

### Task 3: Component Tests (`frontend/src/features/delivery/__tests__/DoorstepChecklistView.test.tsx`)
- Test cases:
  1. Renders pharmacy address, tap-to-call link, and line items with allocated batch numbers.
  2. Marking an item `Refused` requires a reason before submission can be enabled.
  3. Selecting photo proof displays image preview and enables the Submit button once all lines have decisions.
  4. Submitting calls `completeDeliveryOrder` with FormData containing the photo and decisions array.

### Task 4: Full Regression & Build Verification
- Run full backend test suite:
  ```bash
  cd backend && npm test
  ```
- Run full frontend test suite:
  ```bash
  cd frontend && npm test
  ```
- Verify TypeScript compilation and production bundle build:
  ```bash
  cd backend && npm run build
  cd frontend && npm run build
  ```

---

## 3. Verification Criteria

- [ ] Doorstep checklist enforces whole-line acceptance or refusal with mandatory reasons.
- [ ] Camera capture provides immediate preview and client-side 5MB limit validation.
- [ ] Submitting completion sends multipart request and transitions order cleanly.
- [ ] Admin order detail displays delivery partner, photo proof preview, and item refusal reasons.
- [ ] All automated tests pass across backend and frontend (`npm test` clean).
- [ ] Both backend and frontend production builds pass with 0 errors (`npm run build`).
