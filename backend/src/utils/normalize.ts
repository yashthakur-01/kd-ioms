/**
 * Normalizes a text string by trimming leading/trailing whitespace
 * and collapsing multiple consecutive whitespace characters into a single space.
 */
export function normalizeName(str: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}
