# Plan 3-02: Salt Master Module (CRUD, Trigram Similarity & Collision Guard)

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-02`  
**Wave:** 2 (Salt Master API)  
**Dependencies:** Plan 3-01  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the backend Salt Master module (`salt/`): validation schemas, service layer with `pg_trgm` collision warnings and deactivation protections, controller, routes, and comprehensive integration tests.

---

## 2. Tasks & Detailed Instructions

### Task 1: Validation Schemas (`backend/src/modules/salt/salt.validation.ts`)
- Implement Zod schemas:
  - `listSaltsSchema`:
    - `query`: `paginationQuery.extend({ q: z.string().trim().max(100).optional(), isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(), sort: z.string().optional() })`
  - `suggestSaltsSchema`:
    - `query`: `z.object({ q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(80) }).strict()`
  - `createSaltSchema`:
    - `body`: `z.object({ saltName: z.string().trim().min(2, 'Salt name must be at least 2 characters').max(120, 'Salt name cannot exceed 120 characters').regex(/^[A-Za-z0-9\s\-(),.]+$/, 'Salt name contains invalid characters'), confirmSimilar: z.boolean().default(false) }).strict()`
  - `updateSaltSchema`:
    - `params`: `z.object({ saltId: idParam }).strict()`
    - `body`: `z.object({ saltName: z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9\s\-(),.]+$/).optional(), isActive: z.boolean().optional() }).strict().refine(data => data.saltName !== undefined || data.isActive !== undefined, { message: 'At least one field (saltName or isActive) must be provided' })`

### Task 2: Service Layer (`backend/src/modules/salt/salt.service.ts`)
- Implement:
  - `listSalts(query)`:
    - Builds dynamic parameterized SQL against `salts` with LEFT JOIN to count active linked medicines (`COUNT(m.medicine_id) FILTER (WHERE m.is_active = TRUE) AS medicine_count`).
    - Handles text filtering via `LOWER(s.salt_name) ILIKE '%' || LOWER($q) || '%'`.
    - Handles sorting (`saltName:asc`, `saltName:desc`, `createdAt:desc`, etc.) and pagination.
    - Returns `{ rows, totalItems }`.
  - `suggestSalts(q: string)`:
    - Trigram query:
      ```sql
      SELECT salt_id, salt_name, is_active,
             similarity(LOWER(salt_name), LOWER($1)) AS similarity
      FROM salts
      WHERE is_active = TRUE
        AND (similarity(LOWER(salt_name), LOWER($1)) > 0.3
             OR LOWER(salt_name) % LOWER($1)
             OR LOWER(salt_name) ILIKE '%' || LOWER($1) || '%')
      ORDER BY similarity DESC, salt_name ASC
      LIMIT 10;
      ```
    - Maps rows to camelCase `{ saltId, saltName, similarity: Number(row.similarity), isActive }`.
  - `createSalt({ saltName, confirmSimilar }, actor)`:
    - Normalizes `name = normalizeName(saltName)`.
    - Checks exact case-insensitive match (`SELECT salt_id FROM salts WHERE LOWER(TRIM(salt_name)) = LOWER($1)`); if found, throws `ConflictError(ERROR_CODES.DUPLICATE_RESOURCE, 'A salt with this name already exists')`.
    - Unless `confirmSimilar === true`:
      - Queries `pg_trgm` similarity above `0.5`:
        ```sql
        SELECT salt_id, salt_name, similarity(LOWER(salt_name), LOWER($1)) AS score
        FROM salts
        WHERE similarity(LOWER(salt_name), LOWER($1)) > 0.5
        ORDER BY score DESC
        LIMIT 5;
        ```
      - If matches found, throws `ConflictError` with code `ERROR_CODES.SALT_SIMILAR_EXISTS`, message `'Similar salts already exist'`, and `errors: [{ field: 'saltName', code: 'SIMILAR_EXISTS', message: 'Similar salts already exist. Confirm to proceed.', details: { matches } }]`.
    - Inserts into `salts (salt_name, created_by) VALUES ($1, $2) RETURNING *`.
    - Maps DB unique error to `DUPLICATE_RESOURCE` via `mapDbError`.
    - Returns camelCase salt record.
  - `updateSalt(saltId, { saltName, isActive }, actor)`:
    - Checks existence; throws `NotFoundError` if not found.
    - If `isActive === false`:
      - Checks active medicines referencing this salt:
        ```sql
        SELECT COUNT(*)::int AS cnt FROM medicines WHERE is_active = TRUE AND $1 = ANY(salt_ids);
        ```
      - If `cnt > 0`, throws `ConflictError` with code `ERROR_CODES.SALT_IN_USE` (`'Cannot deactivate salt that is used by active medicines'`).
    - If `saltName` is provided:
      - Normalizes `name = normalizeName(saltName)`.
      - Checks uniqueness against other salt records; if duplicate, throws `ConflictError(ERROR_CODES.DUPLICATE_RESOURCE)`.
    - Updates row in `salts` and sets `updated_at = NOW()`.
    - Returns updated camelCase record.

### Task 3: Controller & Route Setup (`backend/src/modules/salt/`)
- `salt.controller.ts`:
  - `listSalts`: returns `okList(res, { code: SUCCESS_CODES.SALTS_LISTED, message: 'Salts listed', data: rows, ... })`.
  - `suggestSalts`: returns `ok(res, { code: SUCCESS_CODES.SALT_SUGGESTIONS, message: 'Salt suggestions fetched', data: suggestions })`.
  - `createSalt`: returns `created(res, { code: SUCCESS_CODES.SALT_CREATED, message: 'Salt created successfully', data: salt })`.
  - `updateSalt`: returns `ok(res, { code: SUCCESS_CODES.SALT_UPDATED, message: 'Salt updated successfully', data: salt })`.
- `salt.route.ts`:
  - Protected with `authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged`.
  - Mounts:
    - `GET /` -> `validate(listSaltsSchema)`, `listSalts`
    - `GET /suggest` -> `validate(suggestSaltsSchema)`, `suggestSalts`
    - `POST /` -> `validate(createSaltSchema)`, `createSalt`
    - `PATCH /:saltId` -> `validate(updateSaltSchema)`, `updateSalt`
- Mount `/api/v1/salts` in `backend/src/routes/index.ts`.

### Task 4: Integration Tests (`backend/src/modules/salt/__tests__/salt.integration.test.ts`)
- Integration tests:
  - Exact duplicate rejected with 409 `DUPLICATE_RESOURCE` (e.g., `"Paracetamol"` vs `"  paracetamol  "`).
  - Near-match (e.g. `"Paracetamol 500"` when `"Paracetamol"` exists) returns 409 `SALT_SIMILAR_EXISTS` with matches array.
  - Repeating near-match with `{ confirmSimilar: true }` succeeds with 201.
  - `GET /salts/suggest?q=Para` returns active matching salts ordered by similarity.
  - Deactivating salt linked to an active medicine fails with 409 `SALT_IN_USE`.
  - Deactivating unlinked salt succeeds with 200.
  - Renaming salt succeeds and updates the row.

---

## 3. Verification & Acceptance Criteria
- [ ] All tests in `backend/src/modules/salt/__tests__/salt.integration.test.ts` pass cleanly.
- [ ] Non-admin requests receive 403 `FORBIDDEN`.
- [ ] Trigram similarity flags near-match collisions properly with `matches` payload.
- [ ] In-use salt deactivation is refused with 409 `SALT_IN_USE`.
