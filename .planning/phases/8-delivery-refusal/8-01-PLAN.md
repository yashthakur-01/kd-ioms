# Plan 8-01: Photo Storage Utility & Multer Setup

**Phase:** Phase 8 — Delivery, Refusal and Proof  
**Plan ID:** `8-01`  
**Wave:** 1 (Storage & Infrastructure Baseline)  
**Dependencies:** Phase 0  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Set up the multipart file handling dependencies (`multer`, `@types/multer`), configure the Supabase Storage utility with local filesystem fallback in `backend/src/utils/storage.ts`, extend environment variables in `backend/src/config/env.ts`, and update the order state machine in `order.helpers.ts` to allow returning orders from `OUT_FOR_DELIVERY` back to `APPROVED` for release/override workflows.

---

## 2. Tasks & Detailed Instructions

### Task 1: Package Dependencies (`backend/package.json`)
- Install `multer` in dependencies and `@types/multer` in devDependencies:
  ```bash
  cd backend && npm install multer && npm install -D @types/multer
  ```

### Task 2: Environment Schema Updates (`backend/src/config/env.ts` & `backend/.env.example`)
- In `backend/src/config/env.ts`, add:
  ```ts
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_DELIVERY_BUCKET: z.string().default('delivery-photos'),
  ```
- In `backend/.env.example`, ensure `SUPABASE_DELIVERY_BUCKET=delivery-photos` is documented.

### Task 3: Storage Utility Service (`backend/src/utils/storage.ts`)
- Implement `uploadDeliveryPhoto(buffer: Buffer, mime: string, orderId: number): Promise<string>`:
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`. If invalid, throw `ValidationError` or `BadRequestError`.
  - Filename generation: `${orderId}-${Date.now()}.${ext}` where ext is derived from MIME type (`jpg`, `png`, `webp`).
  - **Cloud upload:** If `env.SUPABASE_URL` and `env.SUPABASE_SERVICE_ROLE_KEY` are present:
    - Use `@supabase/supabase-js` `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)`.
    - Upload buffer to bucket `env.SUPABASE_DELIVERY_BUCKET`.
    - On upload error, throw an error so the caller can return `502 EXTERNAL_SERVICE_ERROR`.
    - Return object key path (e.g. `delivery-photos/${filename}`).
  - **Local disk fallback:** If cloud credentials are not provided (offline dev / CI tests):
    - Ensure directory `uploads/delivery-photos` exists (`fs.mkdirSync(..., { recursive: true })`).
    - Write buffer to file `uploads/delivery-photos/${filename}`.
    - Return `uploads/delivery-photos/${filename}`.

### Task 4: State Machine Transition Update (`backend/src/modules/order/order.helpers.ts`)
- In `ALLOWED_TRANSITIONS`, update the `OUT_FOR_DELIVERY` rule to permit transitioning back to `APPROVED`:
  ```ts
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.REJECTED,
    ORDER_STATUS.APPROVED, // Permitted for delivery partner self-release or admin override back to pool
  ],
  ```

### Task 5: Unit Tests (`backend/src/utils/__tests__/storage.test.ts`)
- Test cases:
  1. `uploadDeliveryPhoto` validates allowed MIME types and rejects unsupported formats (e.g. `application/pdf`, `text/plain`).
  2. In local fallback mode (no Supabase env), creates directory and saves image file to `uploads/delivery-photos/`, returning the local path.
  3. In mocked Supabase mode, calls `@supabase/supabase-js` storage upload and returns storage key path.
  4. Simulating storage upload failure throws an exception with meaningful error message.
  5. `assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.APPROVED)` passes without throwing.

---

## 3. Verification Criteria

- [ ] `multer` and `@types/multer` installed with clean TypeScript compilation (`npm run lint`).
- [ ] `uploadDeliveryPhoto` successfully saves images in local mode and handles mock Supabase uploads.
- [ ] `assertTransition('OUT_FOR_DELIVERY', 'APPROVED')` succeeds.
- [ ] Unit tests pass cleanly via `npm test -- backend/src/utils/__tests__/storage.test.ts`.
