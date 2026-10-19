# Plan 6-01: Database Migration (004) & Idempotency Middleware

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-01`  
**Wave:** 1 (Foundation & Idempotency Layer)  
**Dependencies:** Phase 0, Phase 5  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver database migration `004_idempotency_keys.sql` to establish the `idempotency_keys` table and build the backend `idempotency` Express middleware (`backend/src/middleware/idempotency.ts`) with cryptographic SHA-256 payload hashing, deterministic replay of cached responses, and payload tampering rejection (`409 IDEMPOTENCY_KEY_REUSED`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Migration `004_idempotency_keys.sql`
- Create `backend/migrations/004_idempotency_keys.sql`:
  ```sql
  -- ============================================================================
  -- Migration 004: Idempotency Keys Storage
  -- ============================================================================

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, user_id)
  );

  CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx ON idempotency_keys(created_at);
  ```
- Run migration script: `npm run db:migrate --workspace=backend`.
- Verify database table exists and primary key constraint `(key, user_id)` is in place.

### Task 2: Idempotency Helper & Middleware (`backend/src/middleware/idempotency.ts`)
- Implement `idempotency` middleware and helper utilities:
  1. **UUID Header Validation:**
     - Checks `req.headers['idempotency-key']`.
     - Validates that the header exists and matches standard UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`).
     - If missing or invalid, throws `ValidationError` (`400 VALIDATION_ERROR`, message: `'Valid Idempotency-Key header (UUID) is required'`).
  2. **Canonical Payload Hashing:**
     - Computes SHA-256 hash of sorted/canonical JSON request body:
       ```ts
       export function computeRequestHash(body: unknown): string {
         const canonicalString = JSON.stringify(body ?? {});
         return crypto.createHash('sha256').update(canonicalString).digest('hex');
       }
       ```
  3. **Lookup & Cache Verification:**
     - Queries `idempotency_keys` for `key = $1 AND user_id = $2`.
     - If record found:
       - If `record.request_hash === requestHash`:
         - Set header `X-Idempotent-Replay: true`.
         - Replay stored response with HTTP status `200 OK` (or the status stored in response):
           ```ts
           res.setHeader('X-Idempotent-Replay', 'true');
           return res.status(200).json(record.response);
           ```
       - If `record.request_hash !== requestHash`:
         - Throw `ConflictError` (`409 IDEMPOTENCY_KEY_REUSED`, message: `'Idempotency key was previously used with a different request payload'`).
  4. **Pass-through Context Attachment:**
     - If no existing record:
       - Attach `req.idempotencyKey = key` and `req.requestHash = requestHash`.
       - Call `next()`.
  5. **Response Persistence Helper:**
     - Export helper `saveIdempotencyKey(clientOrPool, key, userId, requestHash, response)` for saving the response body inside the order creation transaction.

### Task 3: Unit Tests (`backend/src/middleware/__tests__/idempotency.test.ts`)
- Author unit test suite verifying:
  1. Requests missing `Idempotency-Key` header rejected with 400 `VALIDATION_ERROR`.
  2. Requests with non-UUID `Idempotency-Key` rejected with 400 `VALIDATION_ERROR`.
  3. First request with valid key and body proceeds to next handler.
  4. Identical request with same key and body returns cached response with 200 and `X-Idempotent-Replay: true`.
  5. Replayed key with modified request body rejected with 409 `IDEMPOTENCY_KEY_REUSED`.
  6. Two different users can use the same key without conflict (user isolation).

---

## 3. Verification & Acceptance Criteria
- [ ] Migration `004_idempotency_keys.sql` applies without errors.
- [ ] Table `idempotency_keys` verified in database schema.
- [ ] Middleware handles header extraction, canonical hashing, replay, and conflict detection.
- [ ] Tests in `backend/src/middleware/__tests__/idempotency.test.ts` pass with 100% success.
