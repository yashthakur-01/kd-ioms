import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = options.keyGenerator ? options.keyGenerator(req) : ip;
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + options.windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.maxRequests) {
      throw new AppError({
        code: ERROR_CODES.RATE_LIMITED,
        httpStatus: 429,
        message: 'Too many requests, please slow down and try again later',
      });
    }

    next();
  };
}

// General API Rate Limiter: 300 requests per minute
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
});

// Write / Mutating Limiter: 120 per minute
export const writeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

// Login Limiter: 10 attempts per 15 minutes per IP
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});
