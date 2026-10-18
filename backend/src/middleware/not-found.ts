import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(
    new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Cannot ${req.method} ${req.originalUrl || req.url}`,
    })
  );
}
