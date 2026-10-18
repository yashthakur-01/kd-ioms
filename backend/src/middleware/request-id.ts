import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { runWithContext } from '../utils/request-context.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim()
      : `req_${crypto.randomBytes(4).toString('hex')}`;

  res.setHeader('X-Request-Id', requestId);

  runWithContext({ requestId }, () => {
    next();
  });
}
