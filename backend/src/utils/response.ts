import type { Response } from 'express';
import { getRequestId } from './request-context.js';
import type { AppError } from '../errors/app-error.js';

export interface SuccessOptions<T> {
  code: string;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
  status?: number;
}

export interface ListOptions<T> {
  code: string;
  message?: string;
  data: T[];
  page?: number;
  pageSize?: number;
  totalItems: number;
  meta?: Record<string, unknown>;
}

export function ok<T>(res: Response, { code, message = 'Success', data, meta = {} }: SuccessOptions<T>): Response {
  const requestId = getRequestId();
  const timestamp = new Date().toISOString();

  return res.status(200).json({
    success: true,
    code,
    message,
    data,
    meta: {
      requestId,
      timestamp,
      ...meta,
    },
  });
}

export function created<T>(res: Response, { code, message = 'Created', data, meta = {} }: SuccessOptions<T>): Response {
  const requestId = getRequestId();
  const timestamp = new Date().toISOString();

  return res.status(201).json({
    success: true,
    code,
    message,
    data,
    meta: {
      requestId,
      timestamp,
      ...meta,
    },
  });
}

export function okList<T>(
  res: Response,
  { code, message = 'Listed', data, page = 1, pageSize = 20, totalItems, meta = {} }: ListOptions<T>
): Response {
  const requestId = getRequestId();
  const timestamp = new Date().toISOString();
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.status(200).json({
    success: true,
    code,
    message,
    data,
    meta: {
      requestId,
      timestamp,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      ...meta,
    },
  });
}

export function fail(res: Response, error: AppError): Response {
  const requestId = getRequestId();
  const timestamp = new Date().toISOString();

  return res.status(error.httpStatus).json({
    success: false,
    code: error.code,
    message: error.message,
    details: error.details,
    errors: error.errors.length > 0 ? error.errors : undefined,
    meta: {
      requestId,
      timestamp,
    },
  });
}
