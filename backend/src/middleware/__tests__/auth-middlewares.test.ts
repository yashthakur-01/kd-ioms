import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../authenticate.js';
import { authorize } from '../authorize.js';
import { requirePasswordChanged } from '../require-password-changed.js';
import * as db from '../../config/db.js';
import * as tokens from '../../utils/tokens.js';
import { AppError, ForbiddenError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import type { AuthenticatedUser } from '../../types/express.js';

describe('Auth & Authorization Middlewares', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockReq = {
      headers: {},
      url: '/api/v1/users',
      originalUrl: '/api/v1/users',
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('throws AUTH_REQUIRED when Authorization header is absent', async () => {
      await expect(authenticate(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
        AppError
      );

      try {
        await authenticate(mockReq as Request, mockRes as Response, mockNext);
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(ERROR_CODES.AUTH_REQUIRED);
        expect(appErr.httpStatus).toBe(401);
      }
    });

    it('throws AUTH_TOKEN_INVALID when user not found in database', async () => {
      mockReq.headers = { authorization: 'Bearer valid-jwt' };
      vi.spyOn(tokens, 'verifyAccessToken').mockReturnValue({
        sub: 'mock-user-id',
        username: 'testuser',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: false,
      });

      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });

      await expect(authenticate(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
        AppError
      );

      try {
        await authenticate(mockReq as Request, mockRes as Response, mockNext);
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
        expect(appErr.httpStatus).toBe(401);
      }
    });

    it('throws AUTH_ACCOUNT_INACTIVE when user is deactivated in database', async () => {
      mockReq.headers = { authorization: 'Bearer valid-jwt' };
      vi.spyOn(tokens, 'verifyAccessToken').mockReturnValue({
        sub: 'mock-user-id',
        username: 'testuser',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: false,
      });

      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [
          {
            id: 'mock-user-id',
            username: 'testuser',
            role: 'RETAILER',
            phone: '9876543210',
            is_active: false,
            must_change_password: false,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      try {
        await authenticate(mockReq as Request, mockRes as Response, mockNext);
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(ERROR_CODES.AUTH_ACCOUNT_INACTIVE);
        expect(appErr.httpStatus).toBe(403);
      }
    });

    it('populates req.user and calls next() on valid token and active user', async () => {
      mockReq.headers = { authorization: 'Bearer valid-jwt' };
      vi.spyOn(tokens, 'verifyAccessToken').mockReturnValue({
        sub: 'mock-user-id',
        username: 'testuser',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: true,
      });

      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [
          {
            id: 'mock-user-id',
            username: 'testuser',
            role: 'RETAILER',
            phone: '9876543210',
            is_active: true,
            must_change_password: true,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        userId: 'mock-user-id',
        username: 'testuser',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: true,
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('throws FORBIDDEN when user role is not allowed', () => {
      mockReq.user = {
        userId: 'u1',
        username: 'retailer1',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: false,
      };

      const middleware = authorize('ADMIN');
      expect(() => middleware(mockReq as Request, mockRes as Response, mockNext)).toThrow(
        ForbiddenError
      );
    });

    it('calls next() when user role matches permitted roles', () => {
      mockReq.user = {
        userId: 'u1',
        username: 'admin1',
        role: 'ADMIN',
        phone: '9876543210',
        mustChangePassword: false,
      };

      const middleware = authorize('ADMIN', 'RETAILER');
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requirePasswordChanged', () => {
    it('allows request when mustChangePassword is false', () => {
      mockReq.user = {
        userId: 'u1',
        username: 'retailer1',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: false,
      };
      mockReq.originalUrl = '/api/v1/medicines';

      requirePasswordChanged(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows allowed auth endpoints when mustChangePassword is true', () => {
      mockReq.user = {
        userId: 'u1',
        username: 'retailer1',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: true,
      };

      mockReq.originalUrl = '/api/v1/auth/change-password';
      requirePasswordChanged(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      mockReq.originalUrl = '/api/v1/auth/logout';
      requirePasswordChanged(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      mockReq.originalUrl = '/api/v1/auth/me';
      requirePasswordChanged(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('throws AUTH_PASSWORD_CHANGE_REQUIRED on protected non-auth route when mustChangePassword is true', () => {
      mockReq.user = {
        userId: 'u1',
        username: 'retailer1',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: true,
      };
      mockReq.originalUrl = '/api/v1/orders';

      try {
        requirePasswordChanged(mockReq as Request, mockRes as Response, mockNext);
        expect.unreachable('Should have thrown error');
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(ERROR_CODES.AUTH_PASSWORD_CHANGE_REQUIRED);
        expect(appErr.httpStatus).toBe(403);
      }
    });
  });
});
