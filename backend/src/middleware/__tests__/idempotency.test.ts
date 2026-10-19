import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { idempotency, computeRequestHash, saveIdempotencyKey } from '../idempotency.js';
import * as db from '../../config/db.js';
import { ValidationError, ConflictError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

describe('Idempotency Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const testUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.restoreAllMocks();
    mockReq = {
      headers: {},
      body: { medicineId: 1, quantity: 5 },
      user: {
        userId: testUserId,
        username: 'testretailer',
        role: USER_ROLE.RETAILER,
        phone: '9876543210',
        mustChangePassword: false,
      },
    };
    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('rejects request when Idempotency-Key header is missing', async () => {
    mockReq.headers = {};

    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(ValidationError);
    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      httpStatus: 400,
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('rejects request when Idempotency-Key is not a valid UUID', async () => {
    mockReq.headers = { 'idempotency-key': 'not-a-valid-uuid' };

    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(ValidationError);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('rejects request when user is not authenticated', async () => {
    mockReq.headers = { 'idempotency-key': validUuid };
    mockReq.user = undefined;

    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(ValidationError);
    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_REQUIRED,
    });
  });

  it('proceeds and attaches key and hash when key is new', async () => {
    mockReq.headers = { 'idempotency-key': validUuid };
    vi.spyOn(db, 'query').mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await idempotency(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.idempotencyKey).toBe(validUuid);
    expect(mockReq.requestHash).toBe(computeRequestHash(mockReq.body));
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('replays cached response with 200 and X-Idempotent-Replay header when payload matches', async () => {
    mockReq.headers = { 'idempotency-key': validUuid };
    const hash = computeRequestHash(mockReq.body);
    const cachedResponse = {
      success: true,
      code: 'OK',
      data: { orderId: 42, orderNumber: 'ORD-000042' },
    };

    vi.spyOn(db, 'query').mockResolvedValueOnce({
      rows: [
        {
          key: validUuid,
          user_id: testUserId,
          request_hash: hash,
          response: cachedResponse,
        },
      ],
      rowCount: 1,
    });

    await idempotency(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Idempotent-Replay', 'true');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(cachedResponse);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('rejects with 409 IDEMPOTENCY_KEY_REUSED when key exists but payload hash differs', async () => {
    mockReq.headers = { 'idempotency-key': validUuid };
    mockReq.body = { medicineId: 1, quantity: 10 }; // Different body

    const previousHash = computeRequestHash({ medicineId: 1, quantity: 5 });

    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [
        {
          key: validUuid,
          user_id: testUserId,
          request_hash: previousHash,
          response: { orderId: 1 },
        },
      ],
      rowCount: 1,
    });

    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(ConflictError);
    await expect(idempotency(mockReq as Request, mockRes as Response, mockNext)).rejects.toMatchObject({
      code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      httpStatus: 409,
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('saveIdempotencyKey executes INSERT query into idempotency_keys', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) } as any;
    const sampleResponse = { success: true, data: { orderId: 10 } };
    const hash = computeRequestHash({ item: 1 });

    await saveIdempotencyKey(mockClient, validUuid, testUserId, hash, sampleResponse);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO idempotency_keys'),
      [validUuid, testUserId, hash, JSON.stringify(sampleResponse)]
    );
  });
});
