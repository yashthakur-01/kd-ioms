# Plan 5-02: Backend Catalog Module (Repository, Service, Controller & Routes)

**Phase:** Phase 5 — Catalog and Availability  
**Plan ID:** `5-02`  
**Wave:** 2 (Core Catalog Backend)  
**Dependencies:** Plan 5-01  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Implement the complete `catalog` backend module providing `GET /api/v1/catalog` and `GET /api/v1/catalog/:medicineId` with strict tenant and role authorization (`requireApprovedRetailer`), comprehensive query filtering (`q`, `saltId`, `inStock`, `page`, `pageSize`, `sort`), salt names hydration, and total information masking (no batch numbers, costs, or expiry dates exposed).

---

## 2. Tasks & Detailed Instructions

### Task 1: Catalog Validation Schema (`backend/src/modules/catalog/catalog.validation.ts`)
- Implement Zod validation schemas:
  - `getCatalogSchema`:
    - `q`: optional string, trimmed, max 100 characters.
    - `saltId`: optional integer, positive.
    - `inStock`: optional boolean coercion (translates `'true'` / `'1'` to `true`, `'false'` / `'0'` to `false`).
    - `sort`: optional enum `['name', '-name', 'price', '-price']`, default `'name'`.
    - `page`: optional integer, minimum 1, default 1.
    - `pageSize`: optional integer, minimum 1, maximum 50, default 20.
  - `getCatalogItemSchema`:
    - `medicineId`: positive integer coercion.

### Task 2: Catalog Service (`backend/src/modules/catalog/catalog.service.ts`)
- Implement:
  1. `getCatalog(queryFilters, pagination, sort)`:
     - Constructs parameterized SQL query over `v_catalog`.
     - Filter logic:
       - `q`: matches `(name ILIKE $1 OR company ILIKE $1 OR salts_text ILIKE $1)` with wildcards `%$1%`.
       - `saltId`: matches `$2 = ANY(salt_ids)`.
       - `inStock`: if `true`, appends `available_qty > 0`.
     - Order logic:
       - `'name'`: `ORDER BY name ASC`
       - `'-name'`: `ORDER BY name DESC`
       - `'price'`: `ORDER BY max_price_incl_gst ASC NULLS LAST, name ASC`
       - `'-price'`: `ORDER BY max_price_incl_gst DESC NULLS LAST, name ASC`
     - Counts total matching rows using `COUNT(*)::INT`.
     - Paginates with `LIMIT $limit OFFSET $offset`.
     - Hydrates `salts: [{ saltId, saltName }]` by fetching distinct salt IDs from the page and querying `salts` table.
     - Formats numbers: `gstRate`, `maxMrp`, `maxPriceInclGst` formatted as two-decimal numeric strings (or null when out of stock).
     - Returns `{ medicines, pagination: { page, pageSize, total, totalPages } }`.
  2. `getCatalogItem(medicineId: number)`:
     - Queries `v_catalog` by `medicine_id`.
     - Throws `NotFoundError` with `ERROR_CODES.NOT_FOUND` if record does not exist.
     - Hydrates `salts` array.
     - Returns sanitized single medicine catalog record. Ensures zero batch numbers, purchase rates, or expiry dates are present.

### Task 3: Catalog Controller (`backend/src/modules/catalog/catalog.controller.ts`)
- Implement:
  - `getCatalog(req, res)`: Invokes `catalogService.getCatalog`, wraps in envelope `{ success: true, code: 'OK', message: 'Catalog retrieved successfully', data, meta }`.
  - `getCatalogItem(req, res)`: Invokes `catalogService.getCatalogItem`, wraps in envelope `{ success: true, code: 'OK', message: 'Catalog item retrieved successfully', data }`.

### Task 4: Catalog Route & Router Registration (`backend/src/modules/catalog/catalog.route.ts` & `backend/src/routes/index.ts`)
- Create `backend/src/modules/catalog/catalog.route.ts`:
  - Mount `GET /`: `authenticate`, `requireApprovedRetailer`, `validate(getCatalogSchema, 'query')`, `catalogController.getCatalog`.
  - Mount `GET /:medicineId`: `authenticate`, `requireApprovedRetailer`, `validate(getCatalogItemSchema, 'params')`, `catalogController.getCatalogItem`.
- Register in `backend/src/routes/index.ts`:
  ```typescript
  import catalogRouter from '../modules/catalog/catalog.route.js';
  // ...
  router.use('/catalog', catalogRouter);
  ```

### Task 5: Integration Tests (`backend/src/modules/catalog/__tests__/catalog.test.ts`)
- Automated integration test suite verifying:
  1. **Access control:**
     - Unauthenticated requests return 401 `AUTH_REQUIRED`.
     - Retailer in `PENDING` status returns 403 `RETAILER_NOT_APPROVED`.
     - Retailer in `REJECTED` status returns 403 `RETAILER_NOT_APPROVED`.
     - Retailer in `APPROVED` status returns 200 OK.
     - Admin and Delivery roles return 200 OK.
  2. **Search and filtering:**
     - Search by medicine brand name returns matches.
     - Search by company name returns matches.
     - Search by composition string returns matches.
     - Filter `inStock=true` returns strictly items with `availableQty > 0`.
     - Filter `saltId` returns medicines containing that specific salt.
  3. **Sorting:**
     - Sort by price low-to-high orders ascending with nulls at the end.
     - Sort by price high-to-low orders descending with nulls at the end.
  4. **Data sanitization:**
     - Inspects payload to guarantee absence of `batch_number`, `purchase_rate`, `batch_id`, and `expiry_date`.
  5. **Item detail:**
     - `GET /catalog/:medicineId` returns item for valid ID.
     - `GET /catalog/999999` returns 404 `NOT_FOUND`.

---

## 3. Verification & Acceptance Criteria
- [ ] Catalog endpoints respond with standard envelope.
- [ ] Role gating prevents unapproved retailers from viewing catalog data.
- [ ] Query params validate and filter accurately.
- [ ] All tests in `backend/src/modules/catalog/__tests__/catalog.test.ts` pass cleanly.
