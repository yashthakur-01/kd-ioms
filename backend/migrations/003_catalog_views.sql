-- ============================================================================
-- Migration 003: Catalog Views & Search Optimization
-- ============================================================================

DROP VIEW IF EXISTS v_catalog CASCADE;
DROP VIEW IF EXISTS v_medicine_availability CASCADE;

-- 1. Refine Availability View: Sellable on-hand minus PLACED order reservations
CREATE OR REPLACE VIEW v_medicine_availability AS
WITH sellable_stock AS (
  SELECT
    b.medicine_id,
    COALESCE(SUM(b.quantity_on_hand), 0)::INT AS on_hand_qty,
    MAX(b.mrp) AS max_mrp,
    MAX(ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2)) AS max_price_incl_gst
  FROM batches b
  JOIN medicines m ON b.medicine_id = m.medicine_id
  WHERE b.status = 'ACTIVE'
    AND b.expiry_date >= today_ist()
    AND b.quantity_on_hand > 0
  GROUP BY b.medicine_id
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
  m.gst_rate,
  m.salts_text,
  m.salt_ids,
  COALESCE(s.on_hand_qty, 0) AS on_hand_qty,
  COALESCE(r.reserved_qty, 0) AS reserved_qty,
  GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) AS available_qty,
  CASE WHEN COALESCE(s.on_hand_qty, 0) > 0 THEN s.max_mrp ELSE NULL END AS max_mrp,
  CASE WHEN COALESCE(s.on_hand_qty, 0) > 0 THEN s.max_price_incl_gst ELSE NULL END AS max_price_incl_gst,
  (GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) > 0) AS in_stock
FROM medicines m
LEFT JOIN sellable_stock s ON m.medicine_id = s.medicine_id
LEFT JOIN reserved_stock r ON m.medicine_id = r.medicine_id
WHERE m.is_active = TRUE;

-- 2. Refine Public Catalog View for Retailers and Delivery
CREATE OR REPLACE VIEW v_catalog AS
SELECT
  medicine_id,
  name,
  company,
  pack_size,
  salts_text,
  salt_ids,
  gst_rate,
  max_mrp,
  max_price_incl_gst,
  available_qty,
  in_stock
FROM v_medicine_availability;

-- 3. Query & Performance Indexes
CREATE INDEX IF NOT EXISTS batches_availability_idx 
  ON batches (medicine_id, status, expiry_date, quantity_on_hand);

CREATE INDEX IF NOT EXISTS medicines_company_trgm_idx 
  ON medicines USING gin (company gin_trgm_ops);

CREATE INDEX IF NOT EXISTS medicines_salts_text_trgm_idx 
  ON medicines USING gin (salts_text gin_trgm_ops);
