import { describe, it, expect } from 'vitest';
import { parseGs1 } from '../gtin.js';

describe('GS1 Barcode & DataMatrix Parser (parseGs1)', () => {
  it('parses bracketed AI formatted string correctly', () => {
    const raw = '(01)08901234567890(10)BATCH2026A(17)270630';
    const result = parseGs1(raw);

    expect(result.gtin).toBe('08901234567890');
    expect(result.batchNumber).toBe('BATCH2026A');
    expect(result.expiryDate).toBe('2027-06-30');
  });

  it('normalizes day 00 to the last day of the month for expiry', () => {
    // 260200 -> February 2026 -> 2026-02-28
    const raw = '(01)08901111222233(10)LOT99(17)260200';
    const result = parseGs1(raw);

    expect(result.expiryDate).toBe('2026-02-28');
  });

  it('handles leap years accurately for day 00 expiry', () => {
    // 280200 -> February 2028 (leap year) -> 2028-02-29
    const raw = '(01)08901111222233(17)280200';
    const result = parseGs1(raw);

    expect(result.expiryDate).toBe('2028-02-29');
  });

  it('parses stream format with FNC1 (\\x1d) delimiters and symbology prefix', () => {
    const FNC1 = '\x1d';
    const raw = `]d2010890123456789010BATCH-X1${FNC1}17261231`;
    const result = parseGs1(raw);

    expect(result.gtin).toBe('08901234567890');
    expect(result.batchNumber).toBe('BATCH-X1');
    expect(result.expiryDate).toBe('2026-12-31');
  });

  it('handles plain numeric 8, 12, 13, and 14-digit barcodes as GTIN', () => {
    expect(parseGs1('8901234567890')).toEqual({ gtin: '8901234567890' });
    expect(parseGs1('12345678')).toEqual({ gtin: '12345678' });
    expect(parseGs1('00890123456789')).toEqual({ gtin: '00890123456789' });
  });

  it('returns empty object for empty or unrecognizable payloads', () => {
    expect(parseGs1('')).toEqual({});
    expect(parseGs1('   ')).toEqual({});
    expect(parseGs1('UNRECOGNIZED_RANDOM_TEXT')).toEqual({});
  });
});
