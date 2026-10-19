import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/db.js';
import { ForbiddenError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import { USER_ROLE } from '../enums/user-role.enum.js';

/**
 * Middleware that restricts access to approved retailers only.
 * If user is RETAILER and approval_status !== 'APPROVED', returns 403 RETAILER_NOT_APPROVED.
 * Non-retailer users (ADMIN, DELIVERY) pass through without restriction.
 */
export async function requireApprovedRetailer(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role === USER_ROLE.RETAILER) {
    const result = await query(
      `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`,
      [req.user.userId]
    );

    if (result.rowCount === 0 || result.rows[0].approval_status !== 'APPROVED') {
      throw new ForbiddenError({
        code: ERROR_CODES.RETAILER_NOT_APPROVED,
        message: 'Account KYC verification is pending admin approval',
      });
    }
  }

  next();
}
