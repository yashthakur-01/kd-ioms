/**
 * KD-IOMS Date Helpers — India Standard Time (UTC+05:30)
 */

export function todayIst(): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(dateString: string, days: number): string {
  const [yyyy, mm, dd] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(yyyy!, mm! - 1, dd!));
  date.setUTCDate(date.getUTCDate() + days);

  const resY = date.getUTCFullYear();
  const resM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(date.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

export function financialYearOf(dateString: string): string {
  const [yyyy, mm] = dateString.split('-').map(Number);
  const year = yyyy!;
  const month = mm!;

  // Indian financial year runs from April 1 to March 31
  if (month >= 4) {
    const nextYear = String(year + 1).slice(-2);
    return `${year}-${nextYear}`;
  } else {
    const prevYear = year - 1;
    const currentShort = String(year).slice(-2);
    return `${prevYear}-${currentShort}`;
  }
}
