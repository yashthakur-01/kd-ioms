# Plan 3-03: Medicine Master Module (CRUD, GST Price Guard & Trigram Search)

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-03`  
**Wave:** 3 (Medicine Master API)  
**Dependencies:** Plan 3-01, Plan 3-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the backend Medicine Master module (`medicine/`): validation schemas, service layer with salt verification, batch MRP ceiling protection on GST modification, trigram similarity search across names and salts text, single-item aggregation with stock totals, and comprehensive integration tests.

---

## 2. Tasks & Detailed Instructions

### Task 1: Validation Schemas (`backend/src/modules/medicine/medicine.validation.ts`)
- Implement:
  - `createMedicineSchema`:
    - `body`: `z.object({ name: z.string().trim().min(2, 'Name must be 2-150 characters').max(150), company: z.string().trim().min(2, 'Company must be 2-100 characters').max(100), packSize: z.string().trim().max(50).default(''), gstRate: z.number().min(0, 'GST rate must be 0-40%').max(40, 'GST rate cannot exceed 40%'), saltIds: z.array(z.number().int().positive()).max(10, 'Cannot link more than 10 salts').default([]).refine(ids => new Set(ids).size === ids.length, { message: 'Salt IDs must be distinct' }) }).strict()`
  - `listMedicinesSchema`:
    - `query`: `paginationQuery.extend({ q: z.string().trim().max(100).optional(), saltId: z.coerce.number().int().positive().optional(), company: z.string().trim().max(100).optional(), isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(), sort: z.string().optional() })`
  - `searchMedicinesSchema`:
    - `query`: `z.object({ q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(100) }).strict()`
  - `getMedicineSchema`:
    - `params`: `z.object({ medicineId: idParam }).strict()`
  - `updateMedicineSchema`:
    - `params`: `z.object({ medicineId: idParam }).strict()`
    - `body`: `z.object({ name: z.string().trim().min(2).max(150).optional(), company: z.string().trim().min(2).max(100).optional(), packSize: z.string().trim().max(50).optional(), gstRate: z.number().min(0).max(40).optional(), saltIds: z.array(z.number().int().positive()).max(10).refine(ids => new Set(ids).size === ids.length, { message: 'Salt IDs must be distinct' }).optional(), isActive: z.boolean().optional() }).strict().refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' })`

### Task 2: Service Layer (`backend/src/modules/medicine/medicine.service.ts`)
- Implement:
  - `validateSaltIds(saltIds: number[])`:
    - If `saltIds.length === 0`, return empty map.
    - Query `SELECT salt_id, salt_name, is_active FROM salts WHERE salt_id = ANY($1)`.
    - Check if any ID is missing or `is_active === false`. If so, throw `ValidationError` identifying the specific failing field path:
      `errors: [{ field: 'saltIds.' + index, code: 'INVALID_SALT', message: 'Salt ID ' + id + ' does not exist or is inactive' }]`.
    - Returns map of `salt_id -> salt_name`.
  - `createMedicine(dto, actor)`:
    - Normalizes `name = normalizeName(dto.name)`, `company = normalizeName(dto.company)`, `packSize = normalizeName(dto.packSize || '')`.
    - Validates `dto.saltIds` via `validateSaltIds`.
    - Inserts into `medicines (name, company, pack_size, gst_rate, salt_ids, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`.
    - Trigger `trg_medicines_salts_text` automatically derives `salts_text`.
    - Maps database unique violation to `ConflictError(ERROR_CODES.DUPLICATE_RESOURCE)`.
    - Loads salt records to return structured `salts: [{ saltId, saltName }]`.
    - Returns camelCase medicine record.
  - `listMedicines(query)`:
    - Builds parameterized query with filtering: `q`, `saltId` (`$saltId = ANY(salt_ids)`), `company`, `isActive`.
    - Supports sorting (`name:asc`, `name:desc`, `company:asc`, `createdAt:desc`, etc.) and pagination.
    - Loads salt details for all medicines in page in a single batch query (`SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($allSaltIds)`).
    - Formats `gstRate` as string (e.g. `'12.00'`), maps `salts` array.
    - Returns `{ rows, totalItems }`.
  - `searchMedicines(q: string)`:
    - Executes trigram similarity query:
      ```sql
      SELECT 
        m.medicine_id, m.name, m.company, m.pack_size, m.gst_rate, m.salt_ids, m.salts_text, m.is_active,
        GREATEST(similarity(LOWER(m.name), LOWER($1)), similarity(LOWER(m.salts_text), LOWER($1))) AS score
      FROM medicines m
      WHERE m.is_active = TRUE
        AND (
          LOWER(m.name) % LOWER($1) OR similarity(LOWER(m.name), LOWER($1)) > 0.2
          OR LOWER(m.salts_text) % LOWER($1) OR similarity(LOWER(m.salts_text), LOWER($1)) > 0.2
          OR LOWER(m.name) ILIKE '%' || LOWER($1) || '%'
          OR LOWER(m.salts_text) ILIKE '%' || LOWER($1) || '%'
        )
      ORDER BY score DESC, m.name ASC
      LIMIT 15;
      ```
    - Maps salt names and returns array of medicines.
  - `getMedicineById(medicineId: number)`:
    - Fetches medicine row. If not found, throws `NotFoundError(ERROR_CODES.NOT_FOUND, 'Medicine not found')`.
    - Fetches active batches summary:
      ```sql
      SELECT 
        COALESCE(SUM(quantity_on_hand), 0)::int AS on_hand,
        COUNT(*)::int AS active_batch_count
      FROM batches
      WHERE medicine_id = $1 AND status = 'ACTIVE' AND expiry_date >= today_ist();
      ```
    - Fetches linked salt names.
    - Returns mapped medicine object with `onHand` and `activeBatchCount`.
  - `updateMedicine(medicineId: number, dto, actor)`:
    - Verifies medicine exists.
    - If `dto.gstRate !== undefined`:
      - Checks whether any batch of this medicine would violate price ceiling:
        ```sql
        SELECT batch_id, batch_number, mrp, selling_price,
               ROUND(selling_price * (1.0 + ($1 / 100.0)), 2) AS effective_price
        FROM batches
        WHERE medicine_id = $2
          AND ROUND(selling_price * (1.0 + ($1 / 100.0)), 2) > mrp
        LIMIT 1;
        ```
      - If found, throws `BusinessRuleError(ERROR_CODES.PRICE_EXCEEDS_MRP, 'Cannot update GST rate: batch ' || row.batch_number || ' selling price with new GST exceeds MRP')`.
    - If `dto.saltIds !== undefined`:
      - Validates salt IDs via `validateSaltIds`.
    - Normalizes text fields if provided.
    - Dynamically builds `UPDATE medicines SET ... WHERE medicine_id = $id RETURNING *`.
    - Catches unique violation and maps to `DUPLICATE_RESOURCE`.
    - Returns updated camelCase record.

### Task 3: Controller & Route Setup (`backend/src/modules/medicine/`)
- `medicine.controller.ts`:
  - `createMedicine`: returns `created(res, { code: SUCCESS_CODES.MEDICINE_CREATED, data: medicine })`
  - `listMedicines`: returns `okList(res, { code: SUCCESS_CODES.MEDICINES_LISTED, data: rows, ... })`
  - `searchMedicines`: returns `ok(res, { code: SUCCESS_CODES.MEDICINES_SEARCHED, data: matches })`
  - `getMedicineById`: returns `ok(res, { code: SUCCESS_CODES.MEDICINE_FETCHED, data: medicine })`
  - `updateMedicine`: returns `ok(res, { code: SUCCESS_CODES.MEDICINE_UPDATED, data: medicine })`
- `medicine.route.ts`:
  - `GET /search`: protected by `authenticate, authorize(USER_ROLE.ADMIN, USER_ROLE.DELIVERY), requirePasswordChanged`.
  - All other routes (`/`, `/:medicineId`, `POST /`, `PATCH /:medicineId`): protected by `authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged`.
- Mount `/api/v1/medicines` in `backend/src/routes/index.ts`.

### Task 4: Integration Tests (`backend/src/modules/medicine/__tests__/medicine.integration.test.ts`)
- Integration tests:
  - Medicine creation with 0 salts, 1 salt, multiple salts.
  - Unknown salt ID fails with 400 `VALIDATION_ERROR` on `saltIds.<index>`.
  - Inactive salt ID fails with 400 `VALIDATION_ERROR`.
  - Duplicate `(name, company, packSize)` across differing casing fails with 409 `DUPLICATE_RESOURCE`.
  - Renaming a salt updates `salts_text` on linked medicine via DB trigger.
  - Modifying `gstRate` fails with 422 `PRICE_EXCEEDS_MRP` when a batch price exceeds MRP.
  - Modifying `gstRate` succeeds when batches remain below MRP.
  - `GET /medicines/search` returns matches for Admin and Delivery roles.
  - Retailer receives 403 `FORBIDDEN` on medicine administration routes.

---

## 3. Verification & Acceptance Criteria
- [ ] All tests in `backend/src/modules/medicine/__tests__/medicine.integration.test.ts` pass cleanly.
- [ ] Automated trigger correctly populates `salts_text` with alphabetized ` + ` formatting.
- [ ] Price ceiling guard protects MRP when changing GST rate.
- [ ] Trigram search successfully queries both brand name and salts text.
