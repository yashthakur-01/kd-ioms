-- 001_init.sql: KD-IOMS Baseline Schema v1.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. ENUMS & DOMAIN TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'RETAILER', 'DELIVERY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('PLACED', 'APPROVED', 'REJECTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fulfilment_status AS ENUM ('FULL', 'PARTIAL', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_item_status AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE batch_status AS ENUM ('ACTIVE', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM (
    'INWARD', 'RESTOCK', 'RETURN_IN', 'OUTWARD', 'EXPIRY_WRITEOFF', 'DAMAGE', 'CORRECTION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE capture_method AS ENUM ('SCAN_BARCODE', 'SCAN_OCR', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('WHATSAPP', 'EMAIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION today_ist() RETURNS DATE AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. CORE DOMAIN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  phone VARCHAR(15) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS retailer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(120) NOT NULL,
  address_line VARCHAR(250) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(6) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  drug_license_number VARCHAR(50) UNIQUE NOT NULL,
  gstin VARCHAR(15) UNIQUE,
  approval_status approval_status NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salts (
  salt_id SERIAL PRIMARY KEY,
  salt_name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS salts_name_lower_idx ON salts (LOWER(TRIM(salt_name)));
CREATE INDEX IF NOT EXISTS salts_name_trgm_idx ON salts USING gin (LOWER(salt_name) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  company VARCHAR(100) NOT NULL,
  pack_size VARCHAR(50) NOT NULL DEFAULT '',
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00 CHECK (gst_rate >= 0 AND gst_rate <= 40),
  salt_ids INT[] NOT NULL DEFAULT '{}',
  salts_text TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT medicines_identity_unique UNIQUE (name, company, pack_size)
);

CREATE INDEX IF NOT EXISTS medicines_name_trgm_idx ON medicines USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS medicines_salts_trgm_idx ON medicines USING gin (LOWER(salts_text) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS batches (
  batch_id SERIAL PRIMARY KEY,
  medicine_id INT NOT NULL REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  batch_number VARCHAR(50) NOT NULL,
  expiry_date DATE NOT NULL,
  mrp NUMERIC(12,2) NOT NULL CHECK (mrp > 0),
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price > 0),
  purchase_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (purchase_rate >= 0),
  quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  status batch_status NOT NULL DEFAULT 'ACTIVE',
  gtin VARCHAR(14),
  expiry_alert_dismissed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT batches_identity_unique UNIQUE (medicine_id, batch_number, expiry_date, mrp),
  CONSTRAINT batches_price_mrp_check CHECK (selling_price <= mrp)
);

CREATE INDEX IF NOT EXISTS batches_medicine_idx ON batches(medicine_id);
CREATE INDEX IF NOT EXISTS batches_expiry_idx ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS batches_gtin_idx ON batches(gtin);

CREATE TABLE IF NOT EXISTS stock_ledger_entries (
  entry_id SERIAL PRIMARY KEY,
  batch_id INT NOT NULL REFERENCES batches(batch_id) ON DELETE RESTRICT,
  type ledger_entry_type NOT NULL,
  delta INT NOT NULL,
  balance_after INT NOT NULL CHECK (balance_after >= 0),
  reason TEXT,
  supplier_name VARCHAR(150),
  order_id INT,
  order_item_id INT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_ledger_batch_idx ON stock_ledger_entries(batch_id);
CREATE INDEX IF NOT EXISTS stock_ledger_type_idx ON stock_ledger_entries(type);

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  retailer_id UUID NOT NULL REFERENCES users(id),
  delivery_partner_id UUID REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'PLACED',
  note TEXT,
  claimed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  delivery_photo_path TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_retailer_idx ON orders(retailer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_delivery_partner_idx ON orders(delivery_partner_id);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  medicine_id INT NOT NULL REFERENCES medicines(medicine_id),
  requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
  quoted_price_incl_gst NUMERIC(12,2) NOT NULL CHECK (quoted_price_incl_gst > 0),
  picked_quantity INT NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
  fulfilment_status fulfilment_status NOT NULL DEFAULT 'NONE',
  delivery_status delivery_item_status NOT NULL DEFAULT 'PENDING',
  refusal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_picked_lte_requested CHECK (picked_quantity <= requested_quantity)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_allocations (
  allocation_id SERIAL PRIMARY KEY,
  order_item_id INT NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
  batch_id INT NOT NULL REFERENCES batches(batch_id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12,2) NOT NULL CHECK (rate > 0),
  mrp NUMERIC(12,2) NOT NULL CHECK (mrp > 0),
  gst_rate NUMERIC(5,2) NOT NULL,
  capture_method capture_method NOT NULL DEFAULT 'MANUAL',
  scanned_payload TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_allocations_item_idx ON order_allocations(order_item_id);
CREATE INDEX IF NOT EXISTS order_allocations_batch_idx ON order_allocations(batch_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  history_id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  actor_id UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history(order_id);

CREATE TABLE IF NOT EXISTS document_sequences (
  code VARCHAR(10) PRIMARY KEY,
  current_val INT NOT NULL DEFAULT 0
);

INSERT INTO document_sequences (code, current_val)
VALUES ('ORD', 0), ('INV', 0)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION next_document_number(p_code VARCHAR) RETURNS VARCHAR AS $$
DECLARE
  v_val INT;
BEGIN
  UPDATE document_sequences
  SET current_val = current_val + 1
  WHERE code = p_code
  RETURNING current_val INTO v_val;

  IF NOT FOUND THEN
    INSERT INTO document_sequences (code, current_val) VALUES (p_code, 1) RETURNING current_val INTO v_val;
  END IF;

  RETURN p_code || '-' || LPAD(v_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(40) UNIQUE NOT NULL,
  order_id INT UNIQUE NOT NULL REFERENCES orders(order_id),
  retailer_id UUID NOT NULL REFERENCES users(id),
  billed_to JSONB NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  gst_amount NUMERIC(12,2) NOT NULL,
  round_off NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12,2) NOT NULL,
  pdf_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  log_id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  provider_message_id VARCHAR(100),
  error_message TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx ON notification_logs(status, attempts);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES
  ('expiry_alert_days', '{"days": 60}'::jsonb),
  ('business_profile', '{"name": "Kandarp Drugs", "address": "Ahmedabad, Gujarat", "gstin": "24AAAAA0000A1Z5", "drugLicenseNumber": "GJ-AHM-123456", "phone": "+919876543210", "email": "info@kandarpdrugs.com"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. TRIGGERS & BUSINESS INTEGRITY RULES
-- ============================================================================

-- A. Salts Text Synchronization Trigger
CREATE OR REPLACE FUNCTION sync_salts_text_for_medicine() RETURNS TRIGGER AS $$
DECLARE
  v_salts_text TEXT;
BEGIN
  IF array_length(NEW.salt_ids, 1) IS NULL OR array_length(NEW.salt_ids, 1) = 0 THEN
    NEW.salts_text := '';
  ELSE
    SELECT COALESCE(string_agg(salt_name, ' + ' ORDER BY salt_name ASC), '')
    INTO v_salts_text
    FROM salts
    WHERE salt_id = ANY(NEW.salt_ids);

    NEW.salts_text := v_salts_text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medicines_salts_text ON medicines;
CREATE TRIGGER trg_medicines_salts_text
BEFORE INSERT OR UPDATE OF salt_ids ON medicines
FOR EACH ROW
EXECUTE FUNCTION sync_salts_text_for_medicine();

-- B. Allocation Validation Trigger
CREATE OR REPLACE FUNCTION allocations_check_rules_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_order_item RECORD;
  v_effective_price NUMERIC(12,2);
BEGIN
  SELECT * INTO v_batch FROM batches WHERE batch_id = NEW.batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND: Batch % does not exist', NEW.batch_id;
  END IF;

  IF v_batch.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'BATCH_BLOCKED: Batch % is not active', NEW.batch_id;
  END IF;

  IF v_batch.expiry_date < today_ist() THEN
    RAISE EXCEPTION 'BATCH_EXPIRED: Cannot pick from expired batch % (expiry: %)', NEW.batch_id, v_batch.expiry_date;
  END IF;

  SELECT * INTO v_order_item FROM order_items WHERE order_item_id = NEW.order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND: Item % does not exist', NEW.order_item_id;
  END IF;

  IF v_batch.medicine_id != v_order_item.medicine_id THEN
    RAISE EXCEPTION 'BATCH_MEDICINE_MISMATCH: Batch medicine % does not match order item medicine %',
      v_batch.medicine_id, v_order_item.medicine_id;
  END IF;

  v_effective_price := ROUND(v_batch.selling_price * (1.0 + (NEW.gst_rate / 100.0)), 2);
  IF v_effective_price > v_order_item.quoted_price_incl_gst THEN
    RAISE EXCEPTION 'PRICE_EXCEEDS_QUOTE: Batch price incl GST (%) exceeds quoted price (%)',
      v_effective_price, v_order_item.quoted_price_incl_gst;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_allocations_rules ON order_allocations;
CREATE TRIGGER trg_order_allocations_rules
BEFORE INSERT ON order_allocations
FOR EACH ROW
EXECUTE FUNCTION allocations_check_rules_trigger();

-- ============================================================================
-- 5. DATABASE VIEWS
-- ============================================================================

-- Availability View: Sellable on-hand minus PLACED order reservations
CREATE OR REPLACE VIEW v_medicine_availability AS
WITH sellable_stock AS (
  SELECT
    medicine_id,
    COALESCE(SUM(quantity_on_hand), 0)::INT AS on_hand_qty,
    MAX(mrp) AS max_mrp,
    MAX(ROUND(selling_price * (1.0 + ((SELECT gst_rate FROM medicines m WHERE m.medicine_id = b.medicine_id) / 100.0)), 2)) AS max_price_incl_gst
  FROM batches b
  WHERE status = 'ACTIVE' AND expiry_date >= today_ist() AND quantity_on_hand > 0
  GROUP BY medicine_id
),
reserved_stock AS (
  SELECT
    oi.medicine_id,
    COALESCE(SUM(oi.requested_quantity), 0)::INT AS reserved_qty
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.order_id
  WHERE o.status = 'PLACED'
  GROUP BY oi.medicine_id
)
SELECT
  m.medicine_id,
  m.name,
  m.company,
  m.pack_size,
  m.salts_text,
  m.gst_rate,
  COALESCE(s.on_hand_qty, 0) AS on_hand_qty,
  COALESCE(r.reserved_qty, 0) AS reserved_qty,
  GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) AS available_qty,
  s.max_mrp,
  s.max_price_incl_gst,
  (GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) > 0) AS in_stock
FROM medicines m
LEFT JOIN sellable_stock s ON m.medicine_id = s.medicine_id
LEFT JOIN reserved_stock r ON m.medicine_id = r.medicine_id
WHERE m.is_active = TRUE;

-- Catalog View for Retailers and Delivery
CREATE OR REPLACE VIEW v_catalog AS
SELECT
  medicine_id,
  name,
  company,
  pack_size,
  salts_text,
  gst_rate,
  max_mrp,
  max_price_incl_gst,
  available_qty,
  in_stock
FROM v_medicine_availability;

-- Expiry Alerts View
CREATE OR REPLACE VIEW v_expiry_alerts AS
SELECT
  b.batch_id,
  b.medicine_id,
  m.name AS medicine_name,
  b.batch_number,
  b.expiry_date,
  (b.expiry_date - today_ist()) AS days_left,
  b.quantity_on_hand,
  b.mrp,
  b.selling_price
FROM batches b
JOIN medicines m ON b.medicine_id = m.medicine_id
WHERE b.quantity_on_hand > 0
  AND b.expiry_alert_dismissed_at IS NULL
  AND b.expiry_date >= today_ist()
  AND b.expiry_date <= (today_ist() + ((SELECT (value->>'days')::INT FROM app_settings WHERE key = 'expiry_alert_days')));

-- Expired Stock View
CREATE OR REPLACE VIEW v_expired_stock AS
SELECT
  b.batch_id,
  b.medicine_id,
  m.name AS medicine_name,
  b.batch_number,
  b.expiry_date,
  (today_ist() - b.expiry_date) AS days_expired,
  b.quantity_on_hand,
  b.mrp,
  b.selling_price
FROM batches b
JOIN medicines m ON b.medicine_id = m.medicine_id
WHERE b.quantity_on_hand > 0
  AND b.expiry_date < today_ist();
