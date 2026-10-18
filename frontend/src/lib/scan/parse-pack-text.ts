/**
 * Client-Side Packaging OCR Text Parsing Heuristics
 *
 * Extracts batch number, expiry date, and MRP candidates from OCR output
 * on Indian pharmaceutical packaging cartons and strips.
 * Suggestion-only contract: outputs candidates to pre-populate editable form.
 */

export interface ParsedPackTextResult {
  batchNumber?: string;
  expiryDate?: string;
  mrp?: string;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function parsePackText(rawText: string): ParsedPackTextResult {
  if (!rawText || typeof rawText !== 'string') {
    return {};
  }

  const result: ParsedPackTextResult = {};

  // Normalize common OCR artifacts and whitespace
  const normalized = rawText
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Batch Number Extraction
  // Examples: "B.No. A23910", "B.No: B982-1", "Batch No: 99120", "Lot: 8820"
  const batchRegex =
    /(?:B\.?\s*No\.?|Batch(?:\s*No\.?)?|Lot(?:\s*No\.?)?)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]{1,20})/i;
  const batchMatch = normalized.match(batchRegex);
  if (batchMatch && batchMatch[1]) {
    const candidate = batchMatch[1].replace(/[\.\,\:\;]+$/, '').trim();
    if (candidate.length >= 2) {
      result.batchNumber = candidate;
    }
  }

  // 2. Expiry Date Extraction
  // Match prefix followed by date
  // e.g. "EXP: 08/27", "EXP. DATE 11/2028", "USE BEFORE 15/03/2026", "EXP AUG 2027"
  const expPrefixRegex =
    /(?:EXP(?:IRY)?\.?\s*DATE|EXPIRY|EXP|USE\s*BEFORE|BEST\s*BEFORE)\s*[:\-]?\s*([A-Za-z0-9\/\.\-]+(?:\s+[A-Za-z0-9\/\.\-]+)?)/i;
  const expMatch = normalized.match(expPrefixRegex);

  const dateStrToParse = expMatch ? expMatch[1]?.trim() : normalized;

  if (dateStrToParse) {
    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = dateStrToParse.match(/\b([0-3]?\d)[\/\.-]([0-1]?\d)[\/\.-](20\d{2}|\d{2})\b/);
    if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        result.expiryDate = `${year}-${pad2(month)}-${pad2(day)}`;
      }
    } else {
      // Check Month Name with Year: e.g. "AUG 2027" or "AUG/27" or "AUG-2027"
      const monthNameMatch = dateStrToParse.match(/\b([A-Za-z]{3})[\s\/\.-]+(20\d{2}|\d{2})\b/i);
      if (monthNameMatch && monthNameMatch[1] && monthNameMatch[2]) {
        const mKey = monthNameMatch[1].toLowerCase();
        if (MONTH_NAMES[mKey]) {
          const month = MONTH_NAMES[mKey]!;
          let year = parseInt(monthNameMatch[2], 10);
          if (year < 100) year += 2000;
          const lastDay = getLastDayOfMonth(year, month);
          result.expiryDate = `${year}-${pad2(month)}-${pad2(lastDay)}`;
        }
      } else {
        // Check MM/YYYY or MM-YYYY
        const myMatch = dateStrToParse.match(/\b([0-1]?\d)[\/\.-](20\d{2})\b/);
        if (myMatch && myMatch[1] && myMatch[2]) {
          const month = parseInt(myMatch[1], 10);
          const year = parseInt(myMatch[2], 10);
          if (month >= 1 && month <= 12) {
            const lastDay = getLastDayOfMonth(year, month);
            result.expiryDate = `${year}-${pad2(month)}-${pad2(lastDay)}`;
          }
        } else {
          // Check MM/YY or MM-YY (e.g. 08/27)
          const myShortMatch = dateStrToParse.match(/\b([0-1]?\d)[\/\.-](\d{2})\b/);
          if (myShortMatch && myShortMatch[1] && myShortMatch[2]) {
            const month = parseInt(myShortMatch[1], 10);
            const year = 2000 + parseInt(myShortMatch[2], 10);
            if (month >= 1 && month <= 12) {
              const lastDay = getLastDayOfMonth(year, month);
              result.expiryDate = `${year}-${pad2(month)}-${pad2(lastDay)}`;
            }
          }
        }
      }
    }
  }

  // 3. MRP Extraction
  // Examples: "M.R.P. Rs. 145.50", "MRP ₹ 89.00", "M.R.P. INCL. OF ALL TAXES Rs. 210.00"
  const mrpRegex =
    /(?:M\.?\s*R\.?\s*P\.?|MRP|MAX\.?\s*RETAIL\s*PRICE)(?:[^\d\n\r]*?(?:INCL\.?(?:\s*OF)?\s*ALL\s*TAXES)?)?[^\d\n\r]*?(?:Rs\.?|₹|INR)?\s*[:\-]?\s*(\d+(?:\.\d{1,2})?)/i;
  const mrpMatch = normalized.match(mrpRegex);
  if (mrpMatch && mrpMatch[1]) {
    const val = parseFloat(mrpMatch[1]);
    if (!isNaN(val) && val > 0) {
      result.mrp = val.toFixed(2);
    }
  } else {
    // Secondary fallback: "Rs. 145.50" or "₹ 145.50"
    const rsRegex = /(?:Rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)/i;
    const rsMatch = normalized.match(rsRegex);
    if (rsMatch && rsMatch[1]) {
      const val = parseFloat(rsMatch[1]);
      if (!isNaN(val) && val > 0) {
        result.mrp = val.toFixed(2);
      }
    }
  }

  return result;
}
