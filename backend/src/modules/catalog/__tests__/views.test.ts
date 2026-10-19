import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database Migration 003: Catalog Views & Search Indexes', () => {
  const migrationPath = path.resolve(__dirname, '../../../../migrations/003_catalog_views.sql');

  it('migration file 003_catalog_views.sql exists and is non-empty', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql.length).toBeGreaterThan(100);
  });

  it('defines v_medicine_availability with dynamic availability and price ceilings', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE VIEW v_medicine_availability AS');
    expect(sql).toContain('WITH sellable_stock AS');
    expect(sql).toContain('reserved_stock AS');
    expect(sql).toContain('GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) AS available_qty');
    expect(sql).toContain('CASE WHEN COALESCE(s.on_hand_qty, 0) > 0 THEN s.max_mrp ELSE NULL END AS max_mrp');
    expect(sql).toContain('CASE WHEN COALESCE(s.on_hand_qty, 0) > 0 THEN s.max_price_incl_gst ELSE NULL END AS max_price_incl_gst');
    expect(sql).toContain('(GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) > 0) AS in_stock');
  });

  it('projects salts_text and salt_ids in v_medicine_availability and v_catalog', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('m.salts_text');
    expect(sql).toContain('m.salt_ids');
    expect(sql).toContain('CREATE OR REPLACE VIEW v_catalog AS');
    expect(sql).toContain('salts_text,');
    expect(sql).toContain('salt_ids,');
    expect(sql).toContain('FROM v_medicine_availability;');
  });

  it('creates query optimization indexes for batches and medicines', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS batches_availability_idx');
    expect(sql).toContain('ON batches (medicine_id, status, expiry_date, quantity_on_hand)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS medicines_company_trgm_idx');
    expect(sql).toContain('USING gin (company gin_trgm_ops)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS medicines_salts_text_trgm_idx');
    expect(sql).toContain('USING gin (salts_text gin_trgm_ops)');
  });

  it('simulates availability math: sellable minus reserved with zero clamp and null prices', () => {
    // Pure function mathematical verification mirroring the SQL expression
    function computeAvailability(onHand: number, reserved: number, maxMrpRaw: number | null, maxPriceRaw: number | null) {
      const availableQty = Math.max(0, onHand - reserved);
      const inStock = availableQty > 0;
      const maxMrp = onHand > 0 ? maxMrpRaw : null;
      const maxPrice = onHand > 0 ? maxPriceRaw : null;
      return { availableQty, inStock, maxMrp, maxPrice };
    }

    // 1. Fresh stock with zero reservations
    expect(computeAvailability(100, 0, 150.0, 120.0)).toEqual({
      availableQty: 100,
      inStock: true,
      maxMrp: 150.0,
      maxPrice: 120.0,
    });

    // 2. Stock partially reserved
    expect(computeAvailability(100, 40, 150.0, 120.0)).toEqual({
      availableQty: 60,
      inStock: true,
      maxMrp: 150.0,
      maxPrice: 120.0,
    });

    // 3. Stock fully reserved
    expect(computeAvailability(50, 50, 150.0, 120.0)).toEqual({
      availableQty: 0,
      inStock: false,
      maxMrp: 150.0,
      maxPrice: 120.0,
    });

    // 4. Over-reservation clamp (orders requested 80 but only 50 on hand)
    expect(computeAvailability(50, 80, 150.0, 120.0)).toEqual({
      availableQty: 0,
      inStock: false,
      maxMrp: 150.0,
      maxPrice: 120.0,
    });

    // 5. Zero physical stock: prices must be null
    expect(computeAvailability(0, 0, 150.0, 120.0)).toEqual({
      availableQty: 0,
      inStock: false,
      maxMrp: null,
      maxPrice: null,
    });
  });
});
