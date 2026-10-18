import { LIMITS } from '../constants/limits.js';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ParsedPagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export function parsePagination(query: Record<string, any> = {}): ParsedPagination {
  const page = Math.max(1, parseInt(String(query.page || LIMITS.DEFAULT_PAGE), 10) || 1);
  const requestedSize = parseInt(String(query.pageSize || LIMITS.DEFAULT_PAGE_SIZE), 10) || LIMITS.DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requestedSize), LIMITS.MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    offset,
    limit: pageSize,
  };
}

export function buildOrderBy(
  sort: string | undefined,
  allowedSortFields: Record<string, string>,
  defaultClause: string = 'created_at DESC'
): string {
  if (!sort) {
    return defaultClause;
  }

  const isDesc = sort.startsWith('-');
  const rawField = isDesc ? sort.slice(1) : sort;
  const column = allowedSortFields[rawField];

  if (!column) {
    return defaultClause;
  }

  return `${column} ${isDesc ? 'DESC' : 'ASC'}`;
}
