/**
 * KD-IOMS GS1 Barcode & QR Code Parser
 * Supports Application Identifiers (AI) for pharmaceutical traceability:
 * - (01) / 01: GTIN-14 (Global Trade Item Number)
 * - (10) / 10: Batch or Lot Number (alphanumeric, variable length up to 20)
 * - (17) / 17: Expiration Date (YYMMDD format)
 * - (21) / 21: Serial Number (alphanumeric, variable length up to 20)
 */

export interface Gs1ParseResult {
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  serial?: string;
}

/**
 * Normalizes YYMMDD to YYYY-MM-DD.
 * If day is 00, sets to the last calendar day of the month.
 */
function normalizeGs1Date(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;

  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  let dd = parseInt(yymmdd.slice(4, 6), 10);

  if (mm < 1 || mm > 12) return undefined;

  // Assume 20YY for pharma expiry in 21st century (cutoff 50 years)
  const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;

  // Day 00 in GS1 means "end of month"
  if (dd === 0) {
    const lastDayOfMonth = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
    dd = lastDayOfMonth;
  } else {
    // Validate day is within month range
    const maxDay = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
    if (dd > maxDay) return undefined;
  }

  const mmStr = String(mm).padStart(2, '0');
  const ddStr = String(dd).padStart(2, '0');
  return `${yyyy}-${mmStr}-${ddStr}`;
}

/**
 * Parses raw GS1 barcode / DataMatrix / QR payload.
 */
export function parseGs1(payload: string): Gs1ParseResult {
  if (!payload || typeof payload !== 'string') {
    return {};
  }

  const trimmed = payload.trim();
  if (!trimmed) return {};

  // Check if payload is a plain 8, 12, 13, or 14-digit numeric barcode (e.g. standard EAN/UPC/GTIN)
  if (/^\d{8}$|^\d{12,14}$/.test(trimmed)) {
    return { gtin: trimmed };
  }

  const result: Gs1ParseResult = {};

  // 1. Check for bracketed AI format: (01)...(10)...(17)...
  if (trimmed.includes('(') && trimmed.includes(')')) {
    const aiMatches = [...trimmed.matchAll(/\((\d{2})\)([^()]+)/g)];
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
          const parsedDate = normalizeGs1Date(val);
          if (parsedDate) result.expiryDate = parsedDate;
        } else if (ai === '21') {
          result.serial = val;
        }
      }
      return result;
    }
  }

  // 2. Handle stream format (e.g. DataMatrix stream with FNC1 \x1d delimiters)
  // Strip leading Symbology Identifiers like ]d2 or ]C1 if present
  let stream = trimmed;
  if (stream.startsWith(']d2') || stream.startsWith(']C1') || stream.startsWith(']e0')) {
    stream = stream.slice(3);
  }

  // Process stream by known AI prefixes
  let idx = 0;
  const FNC1 = '\x1d';

  while (idx < stream.length) {
    // Check AI 01: GTIN-14 (fixed 14 chars)
    if (stream.startsWith('01', idx)) {
      idx += 2;
      const gtinVal = stream.slice(idx, idx + 14);
      if (/^\d{14}$/.test(gtinVal)) {
        result.gtin = gtinVal;
        idx += 14;
        continue;
      }
    }

    // Check AI 17: Expiry date (fixed 6 chars YYMMDD)
    if (stream.startsWith('17', idx)) {
      idx += 2;
      const dateVal = stream.slice(idx, idx + 6);
      const parsedDate = normalizeGs1Date(dateVal);
      if (parsedDate) {
        result.expiryDate = parsedDate;
        idx += 6;
        continue;
      }
    }

    // Check AI 10: Batch/Lot (variable length up to 20 chars, ending at FNC1 or end of stream)
    if (stream.startsWith('10', idx)) {
      idx += 2;
      const fnc1Idx = stream.indexOf(FNC1, idx);
      if (fnc1Idx !== -1) {
        result.batchNumber = stream.slice(idx, fnc1Idx);
        idx = fnc1Idx + 1;
      } else {
        // Look ahead for another fixed AI like '17' or end
        const remainder = stream.slice(idx);
        // If remainder contains another AI like 17YYMMDD, split before 17
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

    // Check AI 21: Serial (variable length up to 20 chars)
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

    // If no AI matched, advance 1 char to avoid infinite loop
    idx++;
  }

  return result;
}
