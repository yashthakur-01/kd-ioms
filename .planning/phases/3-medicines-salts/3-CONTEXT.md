# Phase 3 Context: Medicines and Salts Master

**Phase:** Phase 3 — Medicines and Salts Master  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 3`)  
**Primary Source:** [`tech.md`](file:///home/yash/D/kd-ioms/tech.md) Section 8, [`REQUIREMENTS.md`](file:///home/yash/D/kd-ioms/.planning/REQUIREMENTS.md) Section 2 (Phase 3), and [`ROADMAP.md`](file:///home/yash/D/kd-ioms/.planning/ROADMAP.md) Phase 3  

---

## 1. Phase Objective & Boundary

Establish a clean master catalog of pharmaceutical salts and medicines preventing duplicates and typographical drift:
- Salt Master management (`GET /salts`, `GET /salts/suggest`, `POST /salts`, `PATCH /salts/:saltId`) with strict text normalization and trigram similarity checking (`pg_trgm` threshold > 0.5) to catch typo collisions.
- Salt deactivation protection (`SALT_IN_USE` 409) if a salt is currently associated with active medicines.
- Database migration `002_salt_rename_trigger.sql`:
  - Automated PostgreSQL trigger on `salts` table ensuring that renaming a salt updates `salts_text` on all linked medicines at the database level.
  - Case-insensitive unique index across `medicines(LOWER(TRIM(name)), LOWER(TRIM(company)), LOWER(TRIM(pack_size)))`.
- Medicine Master management (`POST /medicines`, `GET /medicines`, `GET /medicines/search`, `GET /medicines/:medicineId`, `PATCH /medicines/:medicineId`).
- Strict validation on medicine creation and updates:
  - 0 to 10 distinct active salt IDs; non-existent or inactive salt IDs return 400 `VALIDATION_ERROR` targeting `saltIds.<index>`.
  - GST rate validation (0–40% numeric range, two decimals, with standard presets: 0, 5, 12, 18, 28).
  - Medicine GST rate modifications blocked with 422 `PRICE_EXCEEDS_MRP` if any existing batch price inclusive of the new GST rate exceeds its MRP.
- Trigram similarity search endpoint (`GET /medicines/search`) across medicine name and salts text for Admin, Delivery, and future picking/catalog workflows.
- Frontend Admin portals:
  - Admin Salts Management page (`/salts`) with search, filter, and collision-aware Add/Edit modals.
  - Admin Medicines Management page (`/medicines`) with filters, pagination, and multi-salt badges.
  - Admin Medicine Create & Edit screens (`/medicines/new`, `/medicines/:id/edit`) featuring a hybrid salt selector (predefined active salts with live search + inline "+ Add New Salt" modal with duplicate check) and GST quick-presets.
  - Reusable `MedicineSearch` component for downstream phases (stock inward, catalog, order picking).

---

## 2. Locked Implementation Decisions

### 2.1 Database & Migrations (`002_salt_rename_trigger.sql`)
1. **Automated Salt Rename Sync Trigger:**
   - In `001_init.sql`, `trg_medicines_salts_text` fires `BEFORE INSERT OR UPDATE OF salt_ids ON medicines`.
   - Migration `002_salt_rename_trigger.sql` adds a function `sync_medicines_on_salt_update()` and trigger `trg_salts_update_medicines` that runs `AFTER UPDATE OF salt_name ON salts FOR EACH ROW`:
     ```sql
     CREATE OR REPLACE FUNCTION sync_medicines_on_salt_update() RETURNS TRIGGER AS $$
     BEGIN
       IF OLD.salt_name IS DISTINCT FROM NEW.salt_name THEN
         UPDATE medicines
         SET salt_ids = salt_ids, updated_at = NOW()
         WHERE NEW.salt_id = ANY(salt_ids);
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     DROP TRIGGER IF EXISTS trg_salts_update_medicines ON salts;
     CREATE TRIGGER trg_salts_update_medicines
     AFTER UPDATE OF salt_name ON salts
     FOR EACH ROW
     EXECUTE FUNCTION sync_medicines_on_salt_update();
     ```
   - When triggered, touching `salt_ids = salt_ids` activates `trg_medicines_salts_text`, which rebuilds `salts_text` alphabetically formatted with ` + ` separator.
2. **Case-Insensitive Medicine Identity Index:**
   - Create unique index:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS medicines_identity_lower_idx 
     ON medicines (LOWER(TRIM(name)), LOWER(TRIM(company)), LOWER(TRIM(pack_size)));
     ```
   - Ensures medicines like `"Augmentin 625"` and `"augmentin 625"` under company `"GSK"` collide with 409 `DUPLICATE_RESOURCE`.

### 2.2 Text Normalization & Trigram Similarity
1. **Shared Normalization (`backend/src/utils/normalize.ts`):**
   - `normalizeName(str: string): string`: Trims leading/trailing whitespace and collapses internal multiple whitespace characters down to a single space.
2. **Salt Similarity Algorithm:**
   - Database has `salts_name_trgm_idx` using `pg_trgm`.
   - `POST /salts` checks similarity:
     ```sql
     SELECT salt_id, salt_name, similarity(LOWER(salt_name), LOWER($1)) AS score
     FROM salts
     WHERE similarity(LOWER(salt_name), LOWER($1)) > 0.5
     ORDER BY score DESC
     LIMIT 5;
     ```
   - If matches found and `confirmSimilar !== true`: returns 409 `ConflictError` with code `SALT_SIMILAR_EXISTS` containing the list of matching salts in `errors[0].details.matches`.
   - If `confirmSimilar === true` (or no matches > 0.5): proceeds to insertion.
   - Exact duplicate (case-insensitive) hits `salts_name_lower_idx` and returns 409 `DUPLICATE_RESOURCE` (cannot be overridden by `confirmSimilar`).
3. **Medicine Trigram Search (`GET /medicines/search`):**
   - Query parameter `q` (2–100 chars).
   - Searches across both `name` and `salts_text` using `similarity > 0.2` or `%` operator:
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

### 2.3 Business Rules & Integrity Constraints
1. **Salt Deactivation Guard:**
   - When `PATCH /salts/:saltId` receives `{ isActive: false }`:
   - Checks active medicines referencing this salt: `SELECT COUNT(*) FROM medicines WHERE is_active = TRUE AND $1 = ANY(salt_ids)`.
   - If count > 0, throws 409 `ConflictError` with code `SALT_IN_USE` ("Cannot deactivate salt linked to active medicines").
2. **Medicine Salt Association Integrity:**
   - On `POST /medicines` or `PATCH /medicines/:medicineId` with `saltIds`:
   - Validates array has 0–10 items, all unique positive integers.
   - Verifies against DB: all provided IDs must exist in `salts` and have `is_active = TRUE`.
   - If an ID is missing or inactive, returns 400 `ValidationError` targeting the specific index (e.g. `saltIds.2`: `"Salt ID 15 does not exist or is inactive"`).
3. **GST Rate Modification Guard (`PATCH /medicines/:medicineId`):**
   - If `gstRate` is modified:
   - Query all existing batches of this medicine:
     ```sql
     SELECT batch_id, batch_number, mrp, selling_price,
            ROUND(selling_price * (1.0 + ($1 / 100.0)), 2) AS new_effective_price
     FROM batches
     WHERE medicine_id = $2
       AND ROUND(selling_price * (1.0 + ($1 / 100.0)), 2) > mrp;
     ```
   - If any batch violates the price ceiling: throws 422 `BusinessRuleError` with code `PRICE_EXCEEDS_MRP` ("Cannot update GST rate: batch selling price with new GST rate would exceed MRP").
4. **Medicine Single View Aggregates (`GET /medicines/:medicineId`):**
   - Returns standard medicine fields plus:
   - `salts`: Array of `{ saltId, saltName }`.
   - `onHand`: Total sum of `quantity_on_hand` across all active batches.
   - `activeBatchCount`: Count of batches with `status = 'ACTIVE'`.

### 2.4 Frontend Architecture & User Experience
1. **Admin Salts Page (`/salts`):**
   - Table showing Salt Name, Status Badge, Linked Medicine Count, Created Date, and Actions.
   - Live search input (`q`), status filter (`All`, `Active`, `Inactive`), pagination.
   - "Add Salt" button opens modal with live type-ahead debounced suggestion checking `GET /salts/suggest?q=...`.
   - If similarity detected, renders an alert banner ("Similar salts found: [Paracetamol, Paracetamol Sodium]. Did you mean one of these?").
   - A checkbox "Confirm this is a distinct new salt" enables creation with `confirmSimilar: true`.
   - Edit Salt modal for renaming and status toggling (displays friendly error toast on `SALT_IN_USE`).
2. **Admin Medicines Page (`/medicines`):**
   - Table showing Name, Company, Pack Size, Salts (badges/chips with overflow tooltip), GST Rate, Status, and Actions.
   - Filters: Search (`q`), Salt filter select, Company filter, Status toggle, and sorting (`name:asc`, `name:desc`, `createdAt:desc`).
   - "Add Medicine" button routes to `/medicines/new`.
3. **Medicine Create & Edit Forms (`/medicines/new`, `/medicines/:id/edit`):**
   - Name, Company, and Pack Size inputs with trim normalization.
   - GST Rate input with quick-select pill buttons for standard GST slabs (0%, 5%, 12%, 18%, 28%) and custom input for any valid rate 0–40.00%.
   - **Hybrid Salt Chip Selector:**
     - Displays searchable dropdown/picker of existing active salts.
     - Selected salts display as removable chips (max 10).
     - Inline "+ Add New Salt" action inside the dropdown or button: opens a lightweight modal to create a salt on the fly, checks for duplicates, and upon successful creation, automatically selects it into the medicine form without losing entered form data.
4. **Reusable `MedicineSearch` Component:**
   - Exported from `frontend/src/features/medicines/components/MedicineSearch.tsx`.
   - Debounced search input calling `GET /api/v1/medicines/search?q=...`.
   - Displays medicine name, company, pack size, and highlighted `saltsText`.
   - Emits `onSelect(medicine)` callback for easy reuse in Stock Inward (Phase 4), Order Placement (Phase 6), and Picking (Phase 7).

---

## 3. API Contract Specifications

### 3.1 Salt Endpoints (`/api/v1/salts`)

| Method | Endpoint | Access | Input (Query / Body / Params) | Success Response | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/salts` | Admin | `?q=&isActive=&page=1&pageSize=20&sort=saltName:asc` | `200` List of `{ saltId, saltName, isActive, medicineCount, createdAt }` + `meta.pagination` | None |
| `GET` | `/salts/suggest` | Admin | `?q=string` (min 2, max 80 chars) | `200` Array of up to 10 `{ saltId, saltName, similarity, isActive }` | `VALIDATION_ERROR` |
| `POST` | `/salts` | Admin | `{ saltName: string, confirmSimilar?: boolean }` | `201` `{ saltId, saltName, isActive, createdAt }` | `DUPLICATE_RESOURCE` (409), `SALT_SIMILAR_EXISTS` (409) |
| `PATCH` | `/salts/:saltId`| Admin | `params: { saltId: int }`, `{ saltName?: string, isActive?: boolean }` | `200` `{ saltId, saltName, isActive, updatedAt }` | `NOT_FOUND` (404), `DUPLICATE_RESOURCE` (409), `SALT_IN_USE` (409) |

### 3.2 Medicine Endpoints (`/api/v1/medicines`)

| Method | Endpoint | Access | Input (Query / Body / Params) | Success Response | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/medicines` | Admin | `{ name: string, company: string, packSize?: string, gstRate: number, saltIds: number[] }` | `201` Medicine record with `salts: [{ saltId, saltName }]` | `DUPLICATE_RESOURCE` (409), `VALIDATION_ERROR` (400) |
| `GET` | `/medicines` | Admin | `?q=&saltId=&company=&isActive=&page=1&pageSize=20&sort=name:asc` | `200` List of medicines with `salts`, `saltsText`, formatted `gstRate` + `meta.pagination` | None |
| `GET` | `/medicines/search` | Admin, Delivery | `?q=string` (min 2, max 100 chars) | `200` Up to 15 matching medicines ordered by trigram similarity | `VALIDATION_ERROR` (400) |
| `GET` | `/medicines/:medicineId` | Admin | `params: { medicineId: int }` | `200` Medicine record with `salts`, `onHand`, `activeBatchCount` | `NOT_FOUND` (404) |
| `PATCH` | `/medicines/:medicineId` | Admin | `params: { medicineId: int }`, `{ name?, company?, packSize?, gstRate?, saltIds?, isActive? }` | `200` Updated medicine record | `NOT_FOUND` (404), `DUPLICATE_RESOURCE` (409), `PRICE_EXCEEDS_MRP` (422), `VALIDATION_ERROR` (400) |

---

## 4. Acceptance Criteria & Automated Test Plan

### 4.1 Unit Tests
- `backend/src/utils/__tests__/normalize.test.ts`: Whitespace trimming, collapse of multiple inner spaces, preservation of punctuation (`-`, `(`, `)`, `,`, `.`).
- `backend/src/modules/salt/__tests__/salt.validation.test.ts`: Validates salt names, rejects invalid symbols, validates `confirmSimilar`.
- `backend/src/modules/medicine/__tests__/medicine.validation.test.ts`: Validates name, company, packSize, GST rates (0–40 with 2 decimals), salt IDs array bounds (0–10 distinct integers).

### 4.2 Integration Tests
- **Salt Collision & Deduplication:**
  - Exact match (ignoring whitespace and case, e.g. `"Paracetamol"` and `"  paracetamol  "`) rejected with 409 `DUPLICATE_RESOURCE`.
  - Near match (e.g. `"Paracetamol 500"` when `"Paracetamol"` exists) rejected with 409 `SALT_SIMILAR_EXISTS` containing suggestions.
  - Repeating near match with `{ confirmSimilar: true }` succeeds and creates the salt.
- **Salt Deactivation Protection:**
  - Attempting to deactivate a salt linked to an active medicine fails with 409 `SALT_IN_USE`.
  - Deactivating an unlinked salt succeeds.
- **Automated Salt Rename Trigger:**
  - Renaming a salt updates `salts_text` across all linked medicines automatically in the database.
- **Medicine Lifecycle & Identity:**
  - Creating medicine with unknown or inactive salt ID fails with 400 `VALIDATION_ERROR` indicating the exact field path (e.g. `saltIds.1`).
  - Creating duplicate medicine with same `(name, company, packSize)` across differing casing (e.g. `"Augmentin 625"` vs `"augmentin 625"`) fails with 409 `DUPLICATE_RESOURCE`.
  - Modifying `gstRate` on a medicine when a batch would exceed MRP fails with 422 `PRICE_EXCEEDS_MRP`.
  - `GET /medicines/search` returns matches ordered by similarity when searching by medicine name or salt name.
- **Frontend Verification:**
  - Vitest component tests verifying `SaltTable`, `AddSaltModal` (with collision alert), `MedicineForm` (with salt chips and quick GST buttons), and `MedicineSearch`.

---

## 5. Phase Exit Criteria ("Done When")

- [ ] Migration `002_salt_rename_trigger.sql` applied cleanly with DB-level triggers and case-insensitive unique index.
- [ ] Admin can create, rename, list, and deactivate salts with collision warnings and in-use guards.
- [ ] Admin can create, edit, filter, and search multi-salt medicines with GST presets and instant inline salt creation.
- [ ] All automated unit and integration tests pass cleanly with 0 failures and 0 linter errors.
- [ ] Reusable `MedicineSearch` component is tested and verified for subsequent phases.
