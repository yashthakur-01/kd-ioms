import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { query } from '../config/db.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import type { UserRole } from '../enums/user-role.enum.js';

/**
 * Express middleware that extracts the Bearer token, verifies JWT validity,
 * queries PostgreSQL to ensure the user account is active, and populates req.user.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError({
      code: ERROR_CODES.AUTH_REQUIRED,
      httpStatus: 401,
      message: 'Authentication token is required',
    });
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyAccessToken(token);

  const result = await query(
    'SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1',
    [payload.sub]
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: ERROR_CODES.AUTH_TOKEN_INVALID,
      httpStatus: 401,
      message: 'User account no longer exists',
    });
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new AppError({
      code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
      httpStatus: 403,
      message: 'Your account has been deactivated. Please contact support.',
    });
  }

  req.user = {
    userId: user.id,
    username: user.username,
    role: user.role as UserRole,
    phone: user.phone,
    mustChangePassword: user.must_change_password,
  };

  next();
}
