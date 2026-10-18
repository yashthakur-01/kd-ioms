import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  getRefreshCookieOptions,
  type AccessTokenPayload,
} from '../tokens.js';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

describe('Token Utilities', () => {
  const mockPayload: AccessTokenPayload = {
    sub: '11111111-1111-1111-1111-111111111111',
    username: 'testadmin',
    role: 'ADMIN',
    phone: '9999999999',
    mustChangePassword: false,
  };

  it('signs and verifies a valid access token', () => {
    const token = signAccessToken(mockPayload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(mockPayload.sub);
    expect(decoded.username).toBe(mockPayload.username);
    expect(decoded.role).toBe(mockPayload.role);
    expect(decoded.mustChangePassword).toBe(mockPayload.mustChangePassword);
  });

  it('throws AUTH_TOKEN_EXPIRED when access token has expired', () => {
    const expiredToken = jwt.sign(mockPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: '-1s',
    });

    expect(() => verifyAccessToken(expiredToken)).toThrowError(AppError);
    try {
      verifyAccessToken(expiredToken);
    } catch (err: unknown) {
      const appErr = err as AppError;
      expect(appErr.code).toBe(ERROR_CODES.AUTH_TOKEN_EXPIRED);
      expect(appErr.httpStatus).toBe(401);
    }
  });

  it('throws AUTH_TOKEN_INVALID on tampered signature', () => {
    const validToken = signAccessToken(mockPayload);
    const tamperedToken = validToken.slice(0, -5) + 'abcde';

    expect(() => verifyAccessToken(tamperedToken)).toThrowError(AppError);
    try {
      verifyAccessToken(tamperedToken);
    } catch (err: unknown) {
      const appErr = err as AppError;
      expect(appErr.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
      expect(appErr.httpStatus).toBe(401);
    }
  });

  it('returns secure HttpOnly cookie options for refresh tokens', () => {
    const options = getRefreshCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/api/v1/auth');
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
