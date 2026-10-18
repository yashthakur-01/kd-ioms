import { describe, it, expect } from 'vitest';
import { parsePackText } from '../parse-pack-text.js';

describe('parsePackText Heuristics', () => {
  it('extracts batch, expiry, and MRP from standard medicine carton OCR', () => {
    const ocrText = `
      CIPLA LIMITED
      PARACETAMOL TABLETS IP 500 mg
      B.No. A23910
      MFG. 09/24
      EXP. 08/27
      M.R.P. Rs. 145.50
      INCL. OF ALL TAXES
    `;

    const result = parsePackText(ocrText);
    expect(result.batchNumber).toBe('A23910');
    expect(result.expiryDate).toBe('2027-08-31');
    expect(result.mrp).toBe('145.50');
  });

  it('extracts batch with hyphen, full DD/MM/YYYY date, and rupee symbol', () => {
    const ocrText = `
      TORRENT PHARMA
      Batch No: B982-1
      USE BEFORE: 15/03/2026
      M.R.P. ₹ 89.00
    `;

    const result = parsePackText(ocrText);
    expect(result.batchNumber).toBe('B982-1');
    expect(result.expiryDate).toBe('2026-03-15');
    expect(result.mrp).toBe('89.00');
  });

  it('extracts expiry date with month name (AUG 2027)', () => {
    const ocrText = `
      SUN PHARMACEUTICALS
      Lot: 9941A
      EXP. DATE: AUG 2027
      MRP INCL. OF ALL TAXES Rs. 210.00
    `;

    const result = parsePackText(ocrText);
    expect(result.batchNumber).toBe('9941A');
    expect(result.expiryDate).toBe('2027-08-31');
    expect(result.mrp).toBe('210.00');
  });

  it('extracts 4-digit year format MM/YYYY (11/2028)', () => {
    const ocrText = `
      GLAXOSMITHKLINE
      B.No: G-442
      EXPIRY: 11/2028
      Rs. 55.75
    `;

    const result = parsePackText(ocrText);
    expect(result.batchNumber).toBe('G-442');
    expect(result.expiryDate).toBe('2028-11-30');
    expect(result.mrp).toBe('55.75');
  });

  it('handles empty or unparseable text gracefully without errors', () => {
    expect(parsePackText('')).toEqual({});
    expect(parsePackText('random hospital brochure text without medicine labels')).toEqual({});
  });
});
