import { describe, it, expect } from 'vitest';
import { todayIst, addDays, financialYearOf } from '../dates.js';

describe('Date Utilities (IST & Financial Year)', () => {
  it('returns valid YYYY-MM-DD for todayIst', () => {
    const today = todayIst();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addDays correctly computes future and past dates', () => {
    expect(addDays('2026-10-18', 5)).toBe('2026-10-23');
    expect(addDays('2026-10-18', -18)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('financialYearOf calculates Indian fiscal year (Apr 1 - Mar 31)', () => {
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2026-10-18')).toBe('2026-27');
    expect(financialYearOf('2027-03-31')).toBe('2026-27');
    expect(financialYearOf('2027-04-01')).toBe('2027-28');
    expect(financialYearOf('2026-01-15')).toBe('2025-26');
  });
});
