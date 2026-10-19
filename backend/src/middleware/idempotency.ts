import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import pg from 'pg';
import { query } from '../config/db.js';
import { ValidationError, ConflictError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function computeRequestHash(body: unknown): string {
  const canonicalString = JSON.stringify(body ?? {});
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

export async function saveIdempotencyKey(
  clientOrPool: pg.PoolClient | pg.Pool,
  key: string,
  userId: string,
  requestHash: string,
  response: unknown
): Promise<void> {
  await clientOrPool.query(
    `INSERT INTO idempotency_keys (key, user_id, request_hash, response)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key, user_id) DO NOTHING`,
    [key, userId, requestHash, JSON.stringify(response)]
  );
}

/**
 * Idempotency middleware for state-mutating requests (e.g., POST /orders).
 * Requires 'Idempotency-Key' header with a valid UUID.
 * Computes SHA-256 hash of canonicalized request body.
 * If key was previously processed for this user:
 *   - matching hash: returns cached response with 200 OK and X-Idempotent-Replay: true header.
 *   - differing hash: rejects with 409 IDEMPOTENCY_KEY_REUSED.
 * If key is new: attaches idempotencyKey and requestHash to req and proceeds.
 */
export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const keyHeader = req.headers['idempotency-key'];

  if (!keyHeader || typeof keyHeader !== 'string' || !UUID_REGEX.test(keyHeader.trim())) {
    throw new ValidationError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Valid Idempotency-Key header (UUID) is required',
    });
  }

  const key = keyHeader.trim();
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError({
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'User authentication is required for idempotent requests',
    });
  }

  const requestHash = computeRequestHash(req.body);

  const existing = await query(
    `SELECT key, user_id, request_hash, response FROM idempotency_keys WHERE key = $1 AND user_id = $2`,
    [key, userId]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const record = existing.rows[0];
    if (record.request_hash === requestHash) {
      res.setHeader('X-Idempotent-Replay', 'true');
      const responseData = typeof record.response === 'string' ? JSON.parse(record.response) : record.response;
      res.status(200).json(responseData);
      return;
    }

    throw new ConflictError({
      code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      message: 'Idempotency key was previously used with a different request payload',
    });
  }

  req.idempotencyKey = key;
  req.requestHash = requestHash;
  next();
}
