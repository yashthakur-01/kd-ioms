import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { getActor, getRequestId } from '../utils/request-context.js';

export function accessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const actor = getActor();
    const requestId = getRequestId();

    logger.info(
      {
        msg: 'request',
        requestId,
        userId: actor.userId,
        role: actor.role,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
      },
      'HTTP Access'
    );
  });

  next();
}
