import pino from 'pino';
import { getRequestContext } from '../utils/request-context.js';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'currentPassword',
      'newPassword',
      'temporaryPassword',
      'token',
      'accessToken',
      'refreshToken',
      'headers.authorization',
      'headers.cookie',
      'phone',
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.currentPassword',
      'body.newPassword',
      'user.passwordHash',
    ],
    censor: '[REDACTED]',
  },
  mixin() {
    const ctx = getRequestContext();
    return {
      requestId: ctx?.requestId,
      userId: ctx?.actor?.userId,
      role: ctx?.actor?.role,
    };
  },
});
