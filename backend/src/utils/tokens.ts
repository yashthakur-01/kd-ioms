import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env } from '../config/env.js';
import type { UserRole } from '../enums/user-role.enum.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  phone: string;
  mustChangePassword: boolean;
}

/**
 * Signs a 15-minute JWT access token with the configured secret.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

/**
 * Verifies a JWT access token and returns its decoded payload.
 * Throws typed AppError on expired or invalid signatures.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload & AccessTokenPayload;

    return {
      sub: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      phone: decoded.phone,
      mustChangePassword: decoded.mustChangePassword,
    };
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError({
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        httpStatus: 401,
        message: 'Access token has expired',
      });
    }
    throw new AppError({
      code: ERROR_CODES.AUTH_TOKEN_INVALID,
      httpStatus: 401,
      message: 'Access token is invalid or malformed',
    });
  }
}

/**
 * Returns standard Express cookie options for HttpOnly rotating refresh tokens.
 */
export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}
