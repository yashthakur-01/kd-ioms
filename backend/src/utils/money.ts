/**
 * KD-IOMS Financial Calculations — Integer Paise Mathematics
 * Monetary values are stored as integer paise to prevent floating-point inaccuracies.
 */

export function toPaise(value: string | number): number {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value;
    return Math.round(value * 100);
  }

  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid money string format: "${value}"`);
  }

  const [rupees, paise = ''] = trimmed.split('.');
  const paddedPaise = (paise + '00').slice(0, 2);
  return parseInt(rupees!, 10) * 100 + parseInt(paddedPaise, 10);
}

export function fromPaise(paise: number): string {
  const isNegative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const cents = abs % 100;
  const formatted = `${rupees}.${cents.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

export function addGst(paise: number, gstRatePercent: number): number {
  const tax = (paise * gstRatePercent) / 100;
  return paise + roundHalfUp(tax);
}

export function calculateGstAmount(paise: number, gstRatePercent: number): number {
  return roundHalfUp((paise * gstRatePercent) / 100);
}
