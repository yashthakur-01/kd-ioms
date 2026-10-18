import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../enums/user-role.enum.js';
import { ForbiddenError } from '../errors/app-error.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

/**
 * Higher-order middleware factory that checks if req.user.role is authorized.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError({
        code: ERROR_CODES.AUTH_REQUIRED,
        httpStatus: 401,
        message: 'Authentication is required before checking authorization',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
}
