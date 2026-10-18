/**
 * Database snake_case to camelCase response converters
 */

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

export function toCamel<T extends Record<string, any>>(row: Record<string, any>): T {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel(key);
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[camelKey] = toCamel(value);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date) ? toCamel(item) : item
      );
    } else {
      result[camelKey] = value;
    }
  }

  return result as T;
}

export function toCamelList<T extends Record<string, any>>(rows: Record<string, any>[]): T[] {
  return rows.map((row) => toCamel<T>(row));
}
