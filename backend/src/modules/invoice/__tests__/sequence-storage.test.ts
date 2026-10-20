import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../../config/db.js';
import { financialYearOf } from '../../../utils/dates.js';

describe('Invoice Sequence & FY Scoping (Plan 9-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('determines the correct Indian financial year across March 31 and April 1', () => {
    expect(financialYearOf('2026-03-31')).toBe('2025-26');
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2026-10-20')).toBe('2026-27');
    expect(financialYearOf('2027-03-31')).toBe('2026-27');
    expect(financialYearOf('2027-04-01')).toBe('2027-28');
  });

  it('generates sequential invoice numbers formatted INV/YYYY-YY/00001 per fiscal year', async () => {
    // Simulate database sequence state per FY
    const sequenceStore: Record<string, number> = {};

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('next_invoice_number_for_fy')) {
        const fy = params?.[0];
        const key = `INV_${fy}`;
        sequenceStore[key] = (sequenceStore[key] || 0) + 1;
        const val = sequenceStore[key];
        const formatted = `INV/${fy}/${String(val).padStart(5, '0')}`;
        return {
          rows: [{ next_invoice_number_for_fy: formatted }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const res1 = await db.query('SELECT next_invoice_number_for_fy($1)', ['2026-27']);
    expect(res1.rows[0].next_invoice_number_for_fy).toBe('INV/2026-27/00001');

    const res2 = await db.query('SELECT next_invoice_number_for_fy($1)', ['2026-27']);
    expect(res2.rows[0].next_invoice_number_for_fy).toBe('INV/2026-27/00002');

    // New fiscal year resets counter to 1
    const res3 = await db.query('SELECT next_invoice_number_for_fy($1)', ['2027-28']);
    expect(res3.rows[0].next_invoice_number_for_fy).toBe('INV/2027-28/00001');
  });
});
