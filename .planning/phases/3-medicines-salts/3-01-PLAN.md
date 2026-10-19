# Plan 3-01: Database Migration (002), Normalization & Error Mapping

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-01`  
**Wave:** 1 (Data Integrity Foundation)  
**Dependencies:** Phase 0, Phase 1  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Establish database-level trigger synchronization for salt renames, enforce case-insensitive uniqueness across medicine identities, provide the shared text normalization utility, and configure database error translation for domain constraints.

---

## 2. Tasks & Detailed Instructions

### Task 1: Migration `002_salt_rename_trigger.sql`
- Create `backend/migrations/002_salt_rename_trigger.sql` containing:
  ```sql
  -- ============================================================================
  -- Migration 002: Salt Rename Trigger & Medicine Identity Index
  -- ============================================================================

  -- 1. Automated trigger function to synchronize salts_text on linked medicines when a salt is renamed
  CREATE OR REPLACE FUNCTION sync_medicines_on_salt_update() RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.salt_name IS DISTINCT FROM NEW.salt_name THEN
      -- Touching salt_ids activates trg_medicines_salts_text on medicines table
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

  -- 2. Case-insensitive unique index across medicine identity (name, company, pack_size)
  CREATE UNIQUE INDEX IF NOT EXISTS medicines_identity_lower_idx
  ON medicines (LOWER(TRIM(name)), LOWER(TRIM(company)), LOWER(TRIM(pack_size)));
  ```
- Execute migration via `npm run db:migrate --workspace=backend`.

### Task 2: Shared Normalization Utility (`backend/src/utils/normalize.ts`)
- Implement:
  ```typescript
  /**
   * Normalizes a text string by trimming leading/trailing whitespace
   * and collapsing multiple consecutive whitespace characters into a single space.
   */
  export function normalizeName(str: string): string {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
  }
  ```
- Export from `backend/src/utils/normalize.ts`.

### Task 3: Error Mapping Enhancement (`backend/src/utils/db-error-map.ts`)
- Ensure PostgreSQL 23505 unique constraint errors for `medicines_identity_lower_idx` and `salts_name_lower_idx` cleanly map to `ConflictError` with code `ERROR_CODES.DUPLICATE_RESOURCE`.
- Provide specific error messages:
  - For `salts_name_lower_idx`: `"A salt with this name already exists"`
  - For `medicines_identity_lower_idx`: `"A medicine with this name, company, and pack size already exists"`

### Task 4: Unit Tests (`backend/src/utils/__tests__/normalize.test.ts`)
- Test cases for `normalizeName`:
  - Trims leading and trailing spaces: `"  Paracetamol  "` -> `"Paracetamol"`.
  - Collapses multiple internal spaces/tabs: `"Amoxicillin   and   Clavulanate"` -> `"Amoxicillin and Clavulanate"`.
  - Preserves legitimate punctuation: `"Dextromethorphan HBr (10mg/5ml) - Syrup, 100ml."`.
  - Handles empty and whitespace-only strings gracefully.

---

## 3. Verification & Acceptance Criteria
- [ ] Migration `002_salt_rename_trigger.sql` runs cleanly against the database.
- [ ] Unit tests in `backend/src/utils/__tests__/normalize.test.ts` pass with 100% success.
- [ ] Unique index `medicines_identity_lower_idx` exists on the `medicines` table.
- [ ] Trigger `trg_salts_update_medicines` exists on the `salts` table.
