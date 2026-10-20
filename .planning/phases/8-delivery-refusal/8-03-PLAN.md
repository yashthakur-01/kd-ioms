# Plan 8-03: Doorstep Delivery Completion & Whole-Line Refusal Engine

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-03`  
**Wave:** 3 (Completion, Proof & Refusal Restock)  
**Dependencies:** Plan 8-01, Plan 8-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Implement the complete doorstep delivery fulfillment workflow via `POST /api/v1/delivery/orders/:orderId/complete`. The endpoint handles multipart upload for photo proof, verifies line decisions, performs whole-line doorstep item acceptances or refusals, writes append-only `RETURN_IN` ledger entries restoring original batch quantities for refused lines, and transitions the order to `DELIVERED` (if >=1 item accepted) or `REJECTED` (if 100% items refused). Upload failure aborts safely with 502 `EXTERNAL_SERVICE_ERROR` before the database transaction runs.

---

## 2. Tasks & Detailed Instructions

### Task 1: Multer Memory Storage Middleware (`backend/src/middleware/upload.ts`)
- Configure multer memory storage:
  ```ts
  import multer from 'multer';
  import { BadRequestError } from '../errors/app-error.js';

  export const deliveryPhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB limit
    },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestError({
          code: 'INVALID_FILE_TYPE',
          message: 'Only JPEG, PNG, and WebP images are accepted for delivery proof',
        }));
      }
    },
  });
  ```
- Wrap with standard error formatting middleware to catch `MulterError` (e.g. `LIMIT_FILE_SIZE` -> 400 `FILE_TOO_LARGE`).

### Task 2: Decision Validation Schema (`delivery.validation.ts`)
- Define `completeDeliverySchema`:
  ```ts
  export const lineDecisionSchema = z.object({
    orderItemId: z.number().int().positive(),
    decision: z.enum(['ACCEPTED', 'REFUSED']),
    reason: z.string().min(3).max(200).optional(),
  }).refine((data) => {
    if (data.decision === 'REFUSED') {
      return typeof data.reason === 'string' && data.reason.trim().length >= 3;
    }
    return true;
  }, {
    message: 'Reason (3–200 characters) is required when an item is refused',
    path: ['reason'],
  });

  export const completeDeliveryBodySchema = z.object({
    decisions: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    }, z.array(lineDecisionSchema).min(1, 'At least one line decision is required')),
  });
  ```

### Task 3: Complete Delivery Implementation (`delivery.service.ts`)
- Implement `completeDelivery({ partnerId, orderId, file, decisions })`:
  1. **Validate file presence:** Ensure `file` exists and is non-empty.
  2. **Pre-transaction Photo Upload:**
     ```ts
     let photoPath: string;
     try {
       photoPath = await uploadDeliveryPhoto(file.buffer, file.mimetype, orderId);
     } catch (err: any) {
       throw new ExternalServiceError({
         code: 'EXTERNAL_SERVICE_ERROR',
         message: 'Failed to upload delivery proof photo. Order and inventory remain unchanged.',
         details: { error: err.message },
       });
     }
     ```
  3. **Atomic Transaction (`withTransaction`):**
     - Lock order: `SELECT order_id, order_number, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE`.
     - Check existence (404) and `status === 'OUT_FOR_DELIVERY'` (409 `INVALID_STATE_TRANSITION`).
     - Check `delivery_partner_id === partnerId` (403 `FORBIDDEN`).
     - Query all `order_items` for `order_id`:
       - Verify every line item with `picked_quantity > 0` is represented in `decisions` exactly once. Missing or duplicate lines throw 400 `VALIDATION_ERROR`.
     - Process decisions:
       - For `REFUSED` items:
         - Update `order_items`: `delivery_status = 'REFUSED', refusal_reason = decision.reason`.
         - Query allocations from `order_allocations` for this `order_item_id`.
         - For each allocation, invoke single-entrypoint ledger return:
           ```ts
           await applyLedgerEntry(client, {
             batchId: alloc.batch_id,
             type: LEDGER_ENTRY_TYPE.RETURN_IN,
             delta: alloc.quantity, // Positive delta restores stock on hand
             orderId: order.order_id,
             orderItemId: alloc.order_item_id,
             userId: partnerId,
             reason: `Doorstep refusal: ${decision.reason}`,
           });
           ```
       - For `ACCEPTED` items:
         - Update `order_items`: `delivery_status = 'ACCEPTED'`.
     - Evaluate final order state:
       - If count of `ACCEPTED` lines > 0:
         - Order `status = 'DELIVERED'`, `delivered_at = NOW()`, `delivery_photo_path = photoPath`.
         - Insert `order_status_history`: `OUT_FOR_DELIVERY -> DELIVERED`.
       - If count of `ACCEPTED` lines === 0 (all lines refused):
         - Order `status = 'REJECTED'`, `delivery_photo_path = photoPath`, `rejection_reason = combinedRefusalReasons`.
         - Insert `order_status_history`: `OUT_FOR_DELIVERY -> REJECTED`.
     - Commit transaction.
  4. Return final order summary with item delivery statuses.

### Task 4: Complete Delivery Route (`delivery.route.ts`)
- Add `POST /orders/:orderId/complete`:
  - Middleware chain: `authenticate`, `authorize([USER_ROLE.DELIVERY])`, `deliveryPhotoUpload.single('photo')`, `validateBody(completeDeliveryBodySchema)`, `completeDeliveryController`.

### Task 5: Integration Tests (`backend/src/modules/delivery/__tests__/delivery.complete.test.ts`)
- Comprehensive test suite:
  1. **Partial Acceptance & Refusal:**
     - Order with 2 lines (Line 1: 10 units, Line 2: 5 units).
     - Submit with Line 1 `ACCEPTED` and Line 2 `REFUSED` ("Torn packing").
     - Verifies Line 2 allocations generate `RETURN_IN` (+5) in ledger, batch `quantity_on_hand` increases by 5.
     - Order status transitions to `DELIVERED`, photo path saved.
  2. **100% Refusal:**
     - All lines `REFUSED`.
     - All allocated batches restored via `RETURN_IN`.
     - Order status transitions to `REJECTED`, rejection reason recorded.
  3. **Photo Upload Failure Abort:**
     - Mock storage utility error.
     - Complete delivery returns 502 `EXTERNAL_SERVICE_ERROR`.
     - Order remains `OUT_FOR_DELIVERY`; 0 ledger entries created.
  4. **Authorization Gate:**
     - Unassigned delivery partner receives 403 `FORBIDDEN`.
  5. **Validation Invariants:**
     - Omitting photo fails with 400.
     - Refusing an item without 3+ char reason fails with 400.
     - Missing decision for an active line fails with 400.

---

## 3. Verification Criteria

- [ ] Multipart upload parses photo and decisions JSON seamlessly.
- [ ] Refusing lines immediately executes `RETURN_IN` (+delta) ledger rows and restores `batches.quantity_on_hand`.
- [ ] At least 1 accepted line marks order `DELIVERED`; 100% refused lines mark order `REJECTED`.
- [ ] Failed upload aborts with 502 without touching database.
- [ ] Tests pass via `npm test -- backend/src/modules/delivery/__tests__/delivery.complete.test.ts`.
