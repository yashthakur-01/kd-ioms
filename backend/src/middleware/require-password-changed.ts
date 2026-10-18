import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

const ALLOWED_PATHS = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/logout',
  '/api/v1/auth/me',
];

/**
 * Middleware that blocks any requests to protected resources if the user's
 * mustChangePassword flag is true, forcing them to first change their password.
 */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.mustChangePassword) {
    const requestPath = (req.originalUrl || req.url).split('?')[0];

    const isAllowed = ALLOWED_PATHS.some((path) => requestPath === path || requestPath.endsWith(path));

    if (!isAllowed) {
      throw new AppError({
        code: ERROR_CODES.AUTH_PASSWORD_CHANGE_REQUIRED,
        httpStatus: 403,
        message: 'You must change your password before continuing',
      });
    }
  }

  next();
}
