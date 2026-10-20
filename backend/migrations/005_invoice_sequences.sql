-- Migration 005: FY-scoped invoice sequence generator
-- Extends document_sequences code column to VARCHAR(32) and creates next_invoice_number_for_fy function

ALTER TABLE document_sequences ALTER COLUMN code TYPE VARCHAR(32);

CREATE OR REPLACE FUNCTION next_invoice_number_for_fy(p_fy VARCHAR) RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(32) := 'INV_' || p_fy;
  v_val INT;
BEGIN
  UPDATE document_sequences
  SET current_val = current_val + 1
  WHERE code = v_code
  RETURNING current_val INTO v_val;

  IF NOT FOUND THEN
    INSERT INTO document_sequences (code, current_val)
    VALUES (v_code, 1)
    RETURNING current_val INTO v_val;
  END IF;

  RETURN 'INV/' || p_fy || '/' || LPAD(v_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
