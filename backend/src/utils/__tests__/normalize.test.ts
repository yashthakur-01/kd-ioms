import { describe, it, expect } from 'vitest';
import { normalizeName } from '../normalize.js';

describe('normalizeName utility', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  Paracetamol  ')).toBe('Paracetamol');
    expect(normalizeName('\t\nAmoxicillin\t ')).toBe('Amoxicillin');
  });

  it('collapses multiple internal whitespace characters into a single space', () => {
    expect(normalizeName('Amoxicillin   and   Clavulanate')).toBe('Amoxicillin and Clavulanate');
    expect(normalizeName('Metformin\t\t500mg \n  SR')).toBe('Metformin 500mg SR');
  });

  it('preserves valid characters and medical punctuation', () => {
    const complex = 'Dextromethorphan HBr (10mg/5ml) - Syrup, 100ml.';
    expect(normalizeName(complex)).toBe(complex);
  });

  it('handles empty string and falsy input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
    // @ts-expect-error testing falsy inputs
    expect(normalizeName(null)).toBe('');
    // @ts-expect-error testing falsy inputs
    expect(normalizeName(undefined)).toBe('');
  });
});
