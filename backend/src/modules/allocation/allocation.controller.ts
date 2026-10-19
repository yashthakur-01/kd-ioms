import type { Request, Response } from 'express';
import { allocationService } from './allocation.service.js';
import { resolveScanSchema } from './allocation.validation.js';
import { ok } from '../../utils/response.js';
import { ValidationError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export class AllocationController {
  /**
   * GET /api/v1/orders/:orderId/pick-suggestions
   */
  async getPickSuggestions(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const data = await allocationService.suggest(orderId);
    return ok(res, {
      code: 'PICK_SUGGESTIONS_RETRIEVED',
      message: 'Pick suggestions generated successfully in FEFO order',
      data,
    });
  }

  /**
   * POST /api/v1/batches/resolve-scan
   */
  async resolveScan(req: Request, res: Response) {
    const parsed = resolveScanSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid scan resolution payload',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const data = await allocationService.resolveScan(parsed.data);
    return ok(res, {
      code: 'BATCH_RESOLVED',
      message: 'Batch resolved successfully from scan payload',
      data,
    });
  }
}

export const allocationController = new AllocationController();
