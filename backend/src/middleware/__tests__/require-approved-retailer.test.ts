import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireApprovedRetailer } from '../require-approved-retailer.js';
import * as db from '../../config/db.js';
import { ForbiddenError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

describe('requireApprovedRetailer Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();
  });

  it('passes through when req.user is undefined', async () => {
    mockReq.user = undefined;
    const dbSpy = vi.spyOn(db, 'query');

    await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);

    expect(dbSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('passes through when user role is ADMIN', async () => {
    mockReq.user = {
      userId: 'admin-1',
      username: 'admin',
      role: USER_ROLE.ADMIN,
      phone: '9999999999',
    };
    const dbSpy = vi.spyOn(db, 'query');

    await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);

    expect(dbSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('passes through when user role is DELIVERY', async () => {
    mockReq.user = {
      userId: 'delivery-1',
      username: 'delivery',
      role: USER_ROLE.DELIVERY,
      phone: '8888888888',
    };
    const dbSpy = vi.spyOn(db, 'query');

    await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);

    expect(dbSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('throws RETAILER_NOT_APPROVED when retailer has no profile in database', async () => {
    mockReq.user = {
      userId: 'retailer-1',
      username: 'retailer',
      role: USER_ROLE.RETAILER,
      phone: '9876543210',
    };
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: [],
    });

    await expect(
      requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(ForbiddenError);

    try {
      await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);
    } catch (err: unknown) {
      const appErr = err as ForbiddenError;
      expect(appErr.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
      expect(appErr.httpStatus).toBe(403);
    }
  });

  it('throws RETAILER_NOT_APPROVED when retailer approval_status is PENDING', async () => {
    mockReq.user = {
      userId: 'retailer-1',
      username: 'retailer',
      role: USER_ROLE.RETAILER,
      phone: '9876543210',
    };
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ approval_status: 'PENDING' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    });

    await expect(
      requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(ForbiddenError);

    try {
      await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);
    } catch (err: unknown) {
      const appErr = err as ForbiddenError;
      expect(appErr.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
      expect(appErr.httpStatus).toBe(403);
    }
  });

  it('throws RETAILER_NOT_APPROVED when retailer approval_status is REJECTED', async () => {
    mockReq.user = {
      userId: 'retailer-1',
      username: 'retailer',
      role: USER_ROLE.RETAILER,
      phone: '9876543210',
    };
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ approval_status: 'REJECTED' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    });

    await expect(
      requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(ForbiddenError);
  });

  it('calls next() without error when retailer approval_status is APPROVED', async () => {
    mockReq.user = {
      userId: 'retailer-1',
      username: 'retailer',
      role: USER_ROLE.RETAILER,
      phone: '9876543210',
    };
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ approval_status: 'APPROVED' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    });

    await requireApprovedRetailer(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});
