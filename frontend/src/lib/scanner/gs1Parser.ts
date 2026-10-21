/**
 * KD-IOMS Comprehensive Barcode & QR Code Parser
 * Supports:
 * 1. GS1 DataMatrix with Application Identifiers:
 *    - (01) / 01: GTIN-14
 *    - (10) / 10: Batch or Lot Number
 *    - (17) / 17: Expiration Date (YYMMDD -> YYYY-MM-DD)
 *    - (21) / 21: Serial Number
 * 2. Key-Value Delimited strings (e.g. BATCH:..., EXP:..., GTIN:..., MRP:...)
 * 3. URL query parameters (e.g. ?gtin=...&batch=...&exp=...)
 * 4. Plain standard 8, 12, 13, 14-digit numeric EAN/UPC barcodes
 */

export interface ParsedBarcodeResult {
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  mrp?: string;
  serial?: string;
  rawPayload: string;
}

/**
 * Normalizes YYMMDD or MM/YY or MM/YYYY to ISO YYYY-MM-DD.
 * If day is 00 or missing, defaults to the last calendar day of the month.
 */
export function normalizeDateString(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const clean = dateStr.trim();

  // Format 1: Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Format 2: GS1 standard YYMMDD (6 digits)
  if (/^\d{6}$/.test(clean)) {
    const yy = parseInt(clean.slice(0, 2), 10);
    const mm = parseInt(clean.slice(2, 4), 10);
    let dd = parseInt(clean.slice(4, 6), 10);

    if (mm < 1 || mm > 12) return undefined;

    // Century cutoff: assume 20YY if yy < 50
    const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;

    // Day 00 in GS1 means last day of month
    if (dd === 0) {
      dd = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
    } else {
      const maxDay = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
      if (dd > maxDay) return undefined;
    }

    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  // Format 3: MM/YY or MM/YYYY (common on pharma packs, e.g. 08/27 or 08/2027)
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const mm = parseInt(slashMatch[1], 10);
    let yyyy = parseInt(slashMatch[2], 10);
    if (slashMatch[2].length === 2) {
      yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
    }
    if (mm >= 1 && mm <= 12) {
      const lastDay = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // Format 4: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const dd = parseInt(dmyMatch[1], 10);
    const mm = parseInt(dmyMatch[2], 10);
    let yyyy = parseInt(dmyMatch[3], 10);
    if (dmyMatch[3].length === 2) {
      yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
    }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  return undefined;
}

export function parseBarcodePayload(raw: string): ParsedBarcodeResult {
  if (!raw || typeof raw !== 'string') {
    return { rawPayload: '' };
  }

  const payload = raw.trim();
  const result: ParsedBarcodeResult = { rawPayload: payload };

  if (!payload) return result;

  // 1. Plain Numeric Barcodes (8, 12, 13, 14 digits e.g. EAN-13, EAN-8, UPC, GTIN)
  if (/^\d{8}$|^\d{12,14}$/.test(payload)) {
    result.gtin = payload;
    return result;
  }

  // 2. Bracketed GS1 AI Format: (01)...(17)...(10)...
  if (payload.includes('(') && payload.includes(')')) {
    const aiMatches = [...payload.matchAll(/\((\d{2})\)([^()]+)/g)];
    if (aiMatches.length > 0) {
      for (const match of aiMatches) {
        const ai = match[1];
        const val = match[2]?.trim();
        if (!ai || !val) continue;

        if (ai === '01') {
          result.gtin = val;
        } else if (ai === '10') {
          result.batchNumber = val;
        } else if (ai === '17') {
          const parsed = normalizeDateString(val);
          if (parsed) result.expiryDate = parsed;
        } else if (ai === '21') {
          result.serial = val;
        }
      }
      if (result.gtin || result.batchNumber || result.expiryDate) {
        return result;
      }
    }
  }

  // 3. URL Format: e.g. https://...?gtin=...&batch=...&exp=...
  if (payload.includes('?') && (payload.startsWith('http://') || payload.startsWith('https://'))) {
    try {
      const url = new URL(payload);
      const gtin = url.searchParams.get('gtin') || url.searchParams.get('01');
      const batch = url.searchParams.get('batch') || url.searchParams.get('lot') || url.searchParams.get('10');
      const exp = url.searchParams.get('exp') || url.searchParams.get('expiry') || url.searchParams.get('17');
      const mrp = url.searchParams.get('mrp') || url.searchParams.get('price');

      if (gtin) result.gtin = gtin.trim();
      if (batch) result.batchNumber = batch.trim();
      if (exp) {
        const parsed = normalizeDateString(exp);
        if (parsed) result.expiryDate = parsed;
      }
      if (mrp) {
        const num = parseFloat(mrp.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) result.mrp = num.toFixed(2);
      }
      if (result.gtin || result.batchNumber || result.expiryDate) {
        return result;
      }
    } catch {
      // Ignore URL parse error
    }
  }

  // 4. Key-Value Delimited text (semicolons, commas, pipes, or newlines)
  // e.g. "GTIN:08901234567890;BATCH:A23910;EXP:2027-08-31;MRP:125.00"
  if (/[;,\n|]/.test(payload) && /[:=]/.test(payload)) {
    const parts = payload.split(/[;,\n|]+/);
    for (const part of parts) {
      const [rawKey, ...rawValParts] = part.split(/[:=]/);
      if (!rawKey || rawValParts.length === 0) continue;
      const key = rawKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const val = rawValParts.join(':').trim();

      if (key === 'GTIN' || key === 'EAN' || key === 'BARCODE' || key === '01') {
        result.gtin = val;
      } else if (key === 'BATCH' || key === 'BNO' || key === 'BATCHNO' || key === 'LOT' || key === '10') {
        result.batchNumber = val;
      } else if (key === 'EXP' || key === 'EXPIRY' || key === 'EXPDATE' || key === 'EXPDT' || key === '17') {
        const parsed = normalizeDateString(val);
        if (parsed) result.expiryDate = parsed;
      } else if (key === 'MRP' || key === 'PRICE') {
        const num = parseFloat(val.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) result.mrp = num.toFixed(2);
      }
    }
    if (result.gtin || result.batchNumber || result.expiryDate) {
      return result;
    }
  }

  // 5. Continuous GS1 Stream format (e.g. 01089012345678901727083110A23910)
  let stream = payload;
  if (stream.startsWith(']d2') || stream.startsWith(']C1') || stream.startsWith(']e0')) {
    stream = stream.slice(3);
  }

  const FNC1 = '\x1d';
  let idx = 0;

  while (idx < stream.length) {
    // Check AI 01: GTIN-14 (fixed 14 digits)
    if (stream.startsWith('01', idx)) {
      idx += 2;
      const gtinVal = stream.slice(idx, idx + 14);
      if (/^\d{14}$/.test(gtinVal)) {
        result.gtin = gtinVal;
        idx += 14;
        continue;
      }
    }

    // Check AI 17: Expiry date (fixed 6 digits YYMMDD)
    if (stream.startsWith('17', idx)) {
      idx += 2;
      const dateVal = stream.slice(idx, idx + 6);
      const parsedDate = normalizeDateString(dateVal);
      if (parsedDate) {
        result.expiryDate = parsedDate;
        idx += 6;
        continue;
      }
    }

    // Check AI 10: Batch Number (variable length up to 20 chars)
    if (stream.startsWith('10', idx)) {
      idx += 2;
      const fnc1Idx = stream.indexOf(FNC1, idx);
      if (fnc1Idx !== -1) {
        result.batchNumber = stream.slice(idx, fnc1Idx);
        idx = fnc1Idx + 1;
      } else {
        const remainder = stream.slice(idx);
        const next17 = remainder.search(/17\d{6}/);
        if (next17 !== -1 && next17 > 0) {
          result.batchNumber = remainder.slice(0, next17);
          idx += next17;
        } else {
          result.batchNumber = remainder.slice(0, 20);
          idx += remainder.length;
        }
      }
      continue;
    }

    // Check AI 21: Serial Number (variable length up to 20 chars)
    if (stream.startsWith('21', idx)) {
      idx += 2;
      const fnc1Idx = stream.indexOf(FNC1, idx);
      if (fnc1Idx !== -1) {
        result.serial = stream.slice(idx, fnc1Idx);
        idx = fnc1Idx + 1;
      } else {
        result.serial = stream.slice(idx, idx + 20);
        idx += 20;
      }
      continue;
    }

    idx++;
  }

  // Fallback: If nothing matched but payload looks like a batch number (alphanumeric 3-20 chars)
  if (!result.batchNumber && !result.gtin && /^[A-Za-z0-9\-_]{3,20}$/.test(payload)) {
    result.batchNumber = payload;
  }

  return result;
}
