import { describe, it, expect } from 'vitest';
import { toPaise, fromPaise, addGst, roundHalfUp, calculateGstAmount } from '../money.js';

describe('Money Utilities (Integer Paise Maths)', () => {
  it('converts decimal string to integer paise', () => {
    expect(toPaise('100.80')).toBe(10080);
    expect(toPaise('0.50')).toBe(50);
    expect(toPaise('1234.00')).toBe(123400);
    expect(toPaise('5')).toBe(500);
  });

  it('converts integer paise back to formatted string with 2 decimals', () => {
    expect(fromPaise(10080)).toBe('100.80');
    expect(fromPaise(50)).toBe('0.50');
    expect(fromPaise(123400)).toBe('1234.00');
    expect(fromPaise(0)).toBe('0.00');
  });

  it('handles negative paise accurately', () => {
    expect(fromPaise(-1500)).toBe('-15.00');
  });

  it('throws on invalid money format string', () => {
    expect(() => toPaise('abc')).toThrow();
    expect(() => toPaise('100.805')).toThrow();
  });

  it('adds GST correctly and rounds half up', () => {
    // 10000 paise (100.00) + 12% GST = 11200 paise (112.00)
    expect(addGst(10000, 12)).toBe(11200);
    expect(calculateGstAmount(10000, 12)).toBe(1200);

    // 10050 paise (100.50) + 5% GST = 10050 * 0.05 = 502.5 -> 503
    expect(calculateGstAmount(10050, 5)).toBe(503);
    expect(addGst(10050, 5)).toBe(10553);
  });

  it('roundHalfUp rounds .5 upwards', () => {
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(1.49)).toBe(1);
    expect(roundHalfUp(2.0)).toBe(2);
  });
});
