-- ============================================================================
-- Migration 002: Salt Rename Trigger & Case-Insensitive Medicine Identity Index
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
