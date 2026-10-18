import type { Request, Response } from 'express';
import * as healthService from './health.service.js';
import { ok } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function getHealth(_req: Request, res: Response): Promise<Response> {
  const health = await healthService.checkHealth();
  return ok(res, {
    code: SUCCESS_CODES.HEALTH_OK,
    message: 'System healthy',
    data: health,
  });
}
