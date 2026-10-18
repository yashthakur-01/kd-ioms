# Plan 0-02: Database Baseline, Schema Migration v1.1 & DB Pool

**Phase:** Phase 0 — Foundation  
**Plan ID:** `0-02`  
**Wave:** 2 (Data Foundation)  
**Dependencies:** Plan `0-01`  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`)**  

---

## 1. Objective

Build the PostgreSQL connection pool, transaction helper with deadlock/serialization retry, ascending locking utilities, migration runner, and the baseline database migration `001_init.sql` (schema v1.1) creating all domain tables, constraints, triggers, functions, and views.

---

## 2. Tasks & Detailed Instructions

### Task 1: PostgreSQL Pool & Transaction Manager (`backend/src/config/db.ts`)
- Initialize `pg.Pool` reading `DATABASE_URL` from validated environment config.
- Configure SSL: `{ rejectUnauthorized: false }` for Supabase pooled connections, pool size `max: 10`.
- Export `query(text: string, params?: unknown[])`:
  - Parameterized queries exclusively (no string interpolation).
  - Logs query duration; logs warning when execution exceeds 500ms (`slow query`).
- Export `withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>, opts?: { retries?: number }): Promise<T>`:
  - Default retries = 2.
  - Begins transaction (`BEGIN`), executes callback `fn(client)`, commits (`COMMIT`).
  - Rolls back on error (`ROLLBACK`).
  - Checks PostgreSQL error code: if `40001` (serialization_failure) or `40P01` (deadlock_detected) and attempt < retries, retries loop.
  - Maps any unhandled database error through `mapDbError()`.
  - Releases client in `finally` block.
- Export ascending multi-row lock helpers:
  - `lockMedicines(client: pg.PoolClient, medicineIds: number[]): Promise<void>`: executes `SELECT medicine_id FROM medicines WHERE medicine_id = ANY($1) ORDER BY medicine_id ASC FOR UPDATE`.
  - `lockBatches(client: pg.PoolClient, batchIds: number[]): Promise<void>`: executes `SELECT batch_id FROM batches WHERE batch_id = ANY($1) ORDER BY batch_id ASC FOR UPDATE`.

### Task 2: Migration Runner (`backend/src/db/migrate.ts`)
- Script runnable via `npm run db:migrate --workspace=backend`.
- Creates `schema_migrations` table if not exists:
  ```sql
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- Reads files from `backend/migrations/*.sql` in sorted numerical order.
- Queries `schema_migrations` for applied migrations.
- Executes pending migrations within individual transactions.
- Logs applied migration filename with execution time; handles error reporting with rollback.

### Task 3: Comprehensive Baseline Migration (`backend/migrations/001_init.sql`)
Author `001_init.sql` strictly implementing Schema v1.1 from `tech.md`:
1. **Extensions:** `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` and `CREATE EXTENSION IF NOT EXISTS "pg_trgm";`.
2. **Custom Enums:**
   - `user_role` ('ADMIN', 'RETAILER', 'DELIVERY')
   - `approval_status` ('PENDING', 'APPROVED', 'REJECTED')
   - `order_status` ('PLACED', 'APPROVED', 'REJECTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')
   - `fulfilment_status` ('FULL', 'PARTIAL', 'NONE')
   - `delivery_item_status` ('PENDING', 'ACCEPTED', 'REFUSED')
   - `batch_status` ('ACTIVE', 'BLOCKED')
   - `ledger_entry_type` ('INWARD', 'RESTOCK', 'RETURN_IN', 'OUTWARD', 'EXPIRY_WRITEOFF', 'DAMAGE', 'CORRECTION')
   - `capture_method` ('SCAN_BARCODE', 'SCAN_OCR', 'MANUAL')
   - `notification_channel` ('WHATSAPP', 'EMAIL')
   - `notification_status` ('PENDING', 'SENT', 'FAILED')
3. **Core Tables:**
   - `users`: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, `username VARCHAR(50) UNIQUE NOT NULL`, `password_hash VARCHAR(255) NOT NULL`, `role user_role NOT NULL`, `phone VARCHAR(15) NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `must_change_password BOOLEAN NOT NULL DEFAULT TRUE`, `failed_login_count INT NOT NULL DEFAULT 0`, `locked_until TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `auth_sessions`: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `refresh_token_hash VARCHAR(255) UNIQUE NOT NULL`, `user_agent TEXT`, `ip_address VARCHAR(45)`, `is_revoked BOOLEAN NOT NULL DEFAULT FALSE`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `retailer_profiles`: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `shop_name VARCHAR(120) NOT NULL`, `address_line VARCHAR(250) NOT NULL`, `city VARCHAR(100) NOT NULL`, `state VARCHAR(100) NOT NULL`, `pincode VARCHAR(6) NOT NULL`, `whatsapp_number VARCHAR(20) NOT NULL`, `email VARCHAR(255)`, `drug_license_number VARCHAR(50) UNIQUE NOT NULL`, `gstin VARCHAR(15) UNIQUE`, `approval_status approval_status NOT NULL DEFAULT 'PENDING'`, `rejection_reason TEXT`, `reviewed_by UUID REFERENCES users(id)`, `reviewed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `salts`: `salt_id SERIAL PRIMARY KEY`, `salt_name VARCHAR(120) NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `created_by UUID REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Add unique lower index `CREATE UNIQUE INDEX salts_name_lower_idx ON salts (LOWER(salt_name));`.
   - `medicines`: `medicine_id SERIAL PRIMARY KEY`, `name VARCHAR(150) NOT NULL`, `company VARCHAR(100) NOT NULL`, `pack_size VARCHAR(50) NOT NULL DEFAULT ''`, `gst_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00 CHECK (gst_rate >= 0 AND gst_rate <= 40)`, `salt_ids INT[] NOT NULL DEFAULT '{}'`, `salts_text TEXT NOT NULL DEFAULT ''`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `created_by UUID REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `UNIQUE(name, company, pack_size)`. Add trigram indexes on `name` and `salts_text`.
   - `batches`: `batch_id SERIAL PRIMARY KEY`, `medicine_id INT NOT NULL REFERENCES medicines(medicine_id)`, `batch_number VARCHAR(50) NOT NULL`, `expiry_date DATE NOT NULL`, `mrp NUMERIC(12,2) NOT NULL CHECK (mrp > 0)`, `selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price > 0)`, `purchase_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (purchase_rate >= 0)`, `quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0)`, `status batch_status NOT NULL DEFAULT 'ACTIVE'`, `gtin VARCHAR(14)`, `expiry_alert_dismissed_at TIMESTAMPTZ`, `created_by UUID REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `UNIQUE(medicine_id, batch_number, expiry_date, mrp)`. Check constraint: `selling_price <= mrp`.
   - `stock_ledger_entries`: `entry_id SERIAL PRIMARY KEY`, `batch_id INT NOT NULL REFERENCES batches(batch_id)`, `type ledger_entry_type NOT NULL`, `delta INT NOT NULL`, `balance_after INT NOT NULL CHECK (balance_after >= 0)`, `reason TEXT`, `supplier_name VARCHAR(150)`, `order_id INT`, `order_item_id INT`, `created_by UUID REFERENCES users(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `orders`: `order_id SERIAL PRIMARY KEY`, `order_number VARCHAR(30) UNIQUE NOT NULL`, `retailer_id UUID NOT NULL REFERENCES users(id)`, `delivery_partner_id UUID REFERENCES users(id)`, `status order_status NOT NULL DEFAULT 'PLACED'`, `note TEXT`, `claimed_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`, `cancelled_at TIMESTAMPTZ`, `delivery_photo_path TEXT`, `rejection_reason TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `order_items`: `order_item_id SERIAL PRIMARY KEY`, `order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE`, `medicine_id INT NOT NULL REFERENCES medicines(medicine_id)`, `requested_quantity INT NOT NULL CHECK (requested_quantity > 0)`, `quoted_price_incl_gst NUMERIC(12,2) NOT NULL CHECK (quoted_price_incl_gst > 0)`, `picked_quantity INT NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0)`, `fulfilment_status fulfilment_status NOT NULL DEFAULT 'NONE'`, `delivery_status delivery_item_status NOT NULL DEFAULT 'PENDING'`, `refusal_reason TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `order_allocations`: `allocation_id SERIAL PRIMARY KEY`, `order_item_id INT NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE`, `batch_id INT NOT NULL REFERENCES batches(batch_id)`, `quantity INT NOT NULL CHECK (quantity > 0)`, `rate NUMERIC(12,2) NOT NULL CHECK (rate > 0)`, `mrp NUMERIC(12,2) NOT NULL CHECK (mrp > 0)`, `gst_rate NUMERIC(5,2) NOT NULL`, `capture_method capture_method NOT NULL DEFAULT 'MANUAL'`, `scanned_payload TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `order_status_history`: `history_id SERIAL PRIMARY KEY`, `order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE`, `from_status order_status`, `to_status order_status NOT NULL`, `actor_id UUID REFERENCES users(id)`, `note TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `document_sequences`: `code VARCHAR(10) PRIMARY KEY`, `current_val INT NOT NULL DEFAULT 0`. Initialize: `'ORD'`, `'INV'`.
   - `invoices`: `invoice_id SERIAL PRIMARY KEY`, `invoice_number VARCHAR(40) UNIQUE NOT NULL`, `order_id INT UNIQUE NOT NULL REFERENCES orders(order_id)`, `retailer_id UUID NOT NULL REFERENCES users(id)`, `billed_to JSONB NOT NULL`, `subtotal NUMERIC(12,2) NOT NULL`, `gst_amount NUMERIC(12,2) NOT NULL`, `round_off NUMERIC(12,2) NOT NULL`, `total NUMERIC(12,2) NOT NULL`, `pdf_path TEXT`, `generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `notification_logs`: `log_id SERIAL PRIMARY KEY`, `invoice_id INT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE`, `channel notification_channel NOT NULL`, `recipient VARCHAR(100) NOT NULL`, `status notification_status NOT NULL DEFAULT 'PENDING'`, `attempts INT NOT NULL DEFAULT 0`, `provider_message_id VARCHAR(100)`, `error_message TEXT`, `last_attempt_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `app_settings`: `key VARCHAR(50) PRIMARY KEY`, `value JSONB NOT NULL`, `updated_by UUID REFERENCES users(id)`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Initialize `'expiry_alert_days'` (default: 60) and `'business_profile'`.
4. **Database Functions & Triggers:**
   - Function `today_ist()`:
     ```sql
     CREATE OR REPLACE FUNCTION today_ist() RETURNS DATE AS $$
     BEGIN
       RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
     END;
     $$ LANGUAGE plpgsql STABLE;
     ```
   - Function `next_document_number(p_code VARCHAR)`:
     ```sql
     CREATE OR REPLACE FUNCTION next_document_number(p_code VARCHAR) RETURNS VARCHAR AS $$
     DECLARE
       v_val INT;
     BEGIN
       UPDATE document_sequences SET current_val = current_val + 1 WHERE code = p_code RETURNING current_val INTO v_val;
       RETURN p_code || '-' || LPAD(v_val::TEXT, 6, '0');
     END;
     $$ LANGUAGE plpgsql;
     ```
   - Function & Trigger `sync_salts_text()`: triggers on `salts` update and `medicines` insert/update to keep `medicines.salts_text` refreshed with sorted salt names.
   - Function & Trigger `allocations_check_rules()`: validates expiry against `today_ist()`, confirms batch medicine ID matches order line medicine ID, and asserts `selling_price * (1 + gst_rate/100) <= quoted_price_incl_gst`.
5. **Database Views:**
   - `v_medicine_availability`: Computes sellable quantity (`quantity_on_hand` where `status = 'ACTIVE'` and `expiry_date >= today_ist()`) minus reserved quantities in `orders` where `status = 'PLACED'`.
   - `v_catalog`: Joins `medicines` with `v_medicine_availability` and active batches to provide `medicine_id`, `name`, `company`, `pack_size`, `salts_text`, `gst_rate`, `max_mrp`, `max_price_incl_gst`, `available_qty`, and `in_stock`.
   - `v_expiry_alerts`: Returns batches where `quantity_on_hand > 0`, `expiry_alert_dismissed_at IS NULL`, and `expiry_date BETWEEN today_ist() AND today_ist() + ((SELECT (value->>'days')::INT FROM app_settings WHERE key = 'expiry_alert_days'))`.
   - `v_expired_stock`: Returns batches where `quantity_on_hand > 0` and `expiry_date < today_ist()`.

### Task 4: Automated Tests for DB & Pool
- `backend/src/config/__tests__/db.test.ts`:
  - `withTransaction` commits and returns result on success.
  - `withTransaction` rolls back when error is thrown.
  - `withTransaction` retries up to 2 times on mock error `40001` / `40P01`.
  - Ordered locks `lockMedicines` and `lockBatches` sort keys in ascending order.

---

## 3. Verification & Acceptance Criteria

- [x] `npm run db:migrate` runs cleanly against the Supabase database.
- [x] `schema_migrations` contains `001_init.sql`.
- [x] Database views `v_catalog`, `v_medicine_availability`, `v_expiry_alerts`, `v_expired_stock` query without syntax errors.
- [x] Functions `today_ist()` and `next_document_number('ORD')` execute properly.
- [x] Automated database pool unit tests pass.
