import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response.js';
import * as stockInwardService from './stock-inward.service.js';
import type { InwardStockInput, ScanResolveInput } from './stock-inward.validation.js';

export async function handleInwardStock(req: Request, res: Response): Promise<void> {
  const payload = req.valid.body as InwardStockInput;
  const user = req.user!;

  const result = await stockInwardService.inwardStock(payload, user);
  created(res, {
    code: result.batchCreated ? 'STOCK_BATCH_CREATED' : 'STOCK_BATCH_TOPPED_UP',
    message: result.batchCreated ? 'Batch created and stock inward recorded' : 'Stock topped up onto existing batch',
    data: result,
  });
}

export async function handleResolveScan(req: Request, res: Response): Promise<void> {
  const payload = req.valid.body as ScanResolveInput;

  const result = await stockInwardService.resolveScan(payload.payload);
  ok(res, {
    code: 'SCAN_RESOLVED',
    message: 'Scan payload resolved successfully',
    data: result,
  });
}
