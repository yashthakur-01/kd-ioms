import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import { fail } from '../utils/response.js';
import { logger } from '../config/logger.js';
import { mapDbError } from '../utils/db-error-map.js';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  let appError: AppError;

  // Handle SyntaxError from malformed JSON bodies
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    appError = new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      httpStatus: 400,
      message: 'Malformed JSON payload in request body',
    });
  } else if (err instanceof AppError) {
    appError = err;
  } else if (err?.code && typeof err.code === 'string' && /^\d{5}$|^40[0P]\d{2}$/.test(err.code)) {
    // Database error with Postgres SQLSTATE code
    appError = mapDbError(err);
  } else {
    // Unexpected error — log stack trace and wrap in generic 500
    logger.error(
      {
        err,
        stack: err?.stack,
        url: req.originalUrl || req.url,
        method: req.method,
      },
      'Unhandled internal server error'
    );

    appError = new AppError({
      code: ERROR_CODES.INTERNAL_ERROR,
      httpStatus: 500,
      message: 'An unexpected internal error occurred. Please contact support.',
    });
  }

  // Warn on expected 4xx errors, error on 5xx
  if (appError.httpStatus >= 500) {
    logger.error({ code: appError.code, message: appError.message }, 'Server Error');
  } else if (appError.httpStatus >= 400) {
    logger.warn({ code: appError.code, message: appError.message, errors: appError.errors }, 'Client Rejection');
  }

  fail(res, appError);
}
