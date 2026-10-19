import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../../config/db.js';
import { allocationService } from '../allocation.service.js';
import { NotFoundError } from '../../../errors/app-error.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';

describe('AllocationService - Barcode & Scan Resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundError when payload is empty or whitespace', async () => {
    await expect(allocationService.resolveScan({ payload: '   ' })).rejects.toThrow(NotFoundError);
  });

  it('resolves batch from GS1-128 barcode with GTIN, batch number, and expiry date', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      // Matches on GTIN query
      if (sql.includes('WHERE b.gtin = $1')) {
        expect(params?.[0]).toBe('08901234567890');
        return {
          rows: [
            {
              batch_id: 42,
              medicine_id: 10,
              medicine_name: 'Augmentin 625 Duo',
              batch_number: 'AUG-991',
              expiry_date: '2026-11-30',
              mrp: '210.00',
              selling_price: '180.00',
              gst_rate: '12.00',
              quantity_on_hand: 50,
              price_incl_gst: '201.60',
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const res = await allocationService.resolveScan({
      payload: '(01)08901234567890(17)261130(10)AUG-991',
    });

    expect(res.batchId).toBe(42);
    expect(res.medicineId).toBe(10);
    expect(res.medicineName).toBe('Augmentin 625 Duo');
    expect(res.batchNumber).toBe('AUG-991');
    expect(res.priceInclGst).toBe('201.60');
    expect(res.quantityOnHand).toBe(50);
  });

  it('resolves batch by composite (batch_number, expiry_date) when GTIN not found in database', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      // GTIN lookup returns empty
      if (sql.includes('WHERE b.gtin = $1')) {
        return { rows: [], rowCount: 0 } as any;
      }

      // Batch number + expiry lookup
      if (sql.includes('b.expiry_date = $2') && sql.includes('b.batch_number')) {
        expect(params?.[0]).toBe('CAL-100');
        expect(params?.[1]).toBe('2026-12-31');
        return {
          rows: [
            {
              batch_id: 77,
              medicine_id: 20,
              medicine_name: 'Calpol 500mg',
              batch_number: 'CAL-100',
              expiry_date: '2026-12-31',
              mrp: '45.00',
              selling_price: '35.00',
              gst_rate: '12.00',
              quantity_on_hand: 120,
              price_incl_gst: '39.20',
            },
          ],
          rowCount: 1,
        } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const res = await allocationService.resolveScan({
      payload: '(01)99999999999999(17)261231(10)CAL-100',
    });

    expect(res.batchId).toBe(77);
    expect(res.batchNumber).toBe('CAL-100');
    expect(res.medicineName).toBe('Calpol 500mg');
  });

  it('falls back to raw batch number lookup when barcode contains only lot number', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('LOWER(TRIM(b.batch_number)) = LOWER(TRIM($1))')) {
        expect(params?.[0]).toBe('RAW-LOT-555');
        return {
          rows: [
            {
              batch_id: 88,
              medicine_id: 30,
              medicine_name: 'Azithromycin 500mg',
              batch_number: 'RAW-LOT-555',
              expiry_date: '2027-08-31',
              mrp: '120.00',
              selling_price: '95.00',
              gst_rate: '12.00',
              quantity_on_hand: 25,
              price_incl_gst: '106.40',
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const res = await allocationService.resolveScan({
      payload: 'RAW-LOT-555',
    });

    expect(res.batchId).toBe(88);
    expect(res.batchNumber).toBe('RAW-LOT-555');
  });

  it('throws NotFoundError with BATCH_NOT_FOUND when no active unexpired batch exists', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({ rows: [], rowCount: 0 } as any);

    await expect(
      allocationService.resolveScan({
        payload: 'UNKNOWN-BARCODE-999',
      })
    ).rejects.toThrow(NotFoundError);
  });
});
