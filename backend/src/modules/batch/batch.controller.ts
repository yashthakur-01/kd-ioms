import type { Request, Response } from 'express';
import * as batchService from './batch.service.js';
import { ok, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';
import type {
  ListBatchesQuery,
  GetBatchParams,
  UpdateBatchParams,
  UpdateBatchInput,
  AdjustBatchParams,
  AdjustBatchInput,
  ListLedgerQuery,
  RemoveExpiredParams,
  RemoveExpiredInput,
} from './batch.validation.js';

export async function handleListBatches(req: Request, res: Response): Promise<Response> {
  const query = (req as unknown as { valid: { query: ListBatchesQuery } }).valid.query;
  const { rows, totalItems, page, pageSize } = await batchService.listBatches(query);

  return okList(res, {
    code: SUCCESS_CODES.BATCHES_LISTED,
    message: 'Batches listed successfully',
    data: rows,
    page,
    pageSize,
    totalItems,
  });
}

export async function handleGetBatch(req: Request, res: Response): Promise<Response> {
  const { batchId } = (req as unknown as { valid: { params: GetBatchParams } }).valid.params;
  const data = await batchService.getBatchById(batchId);

  return ok(res, {
    code: SUCCESS_CODES.BATCH_FETCHED,
    message: 'Batch fetched successfully',
    data,
  });
}

export async function handleUpdateBatch(req: Request, res: Response): Promise<Response> {
  const { batchId } = (req as unknown as { valid: { params: UpdateBatchParams } }).valid.params;
  const body = (req as unknown as { valid: { body: UpdateBatchInput } }).valid.body;
  const updatedBatch = await batchService.updateBatch(batchId, body);

  return ok(res, {
    code: SUCCESS_CODES.BATCH_UPDATED,
    message: 'Batch updated successfully',
    data: updatedBatch,
  });
}

export async function handleAdjustBatch(req: Request, res: Response): Promise<Response> {
  const { batchId } = (req as unknown as { valid: { params: AdjustBatchParams } }).valid.params;
  const body = (req as unknown as { valid: { body: AdjustBatchInput } }).valid.body;
  const actor = { userId: req.user!.userId };
  const result = await batchService.adjustBatch(batchId, body, actor);

  return ok(res, {
    code: SUCCESS_CODES.BATCH_ADJUSTED,
    message: 'Batch stock adjusted successfully',
    data: result,
  });
}

export async function handleRemoveExpired(req: Request, res: Response): Promise<Response> {
  const { batchId } = (req as unknown as { valid: { params: RemoveExpiredParams } }).valid.params;
  const body = (req as unknown as { valid: { body: RemoveExpiredInput } }).valid.body;
  const actor = { userId: req.user!.userId };
  const result = await batchService.removeExpired(batchId, actor, body);

  return ok(res, {
    code: SUCCESS_CODES.EXPIRED_BATCH_REMOVED,
    message: 'Expired batch removed successfully',
    data: result,
  });
}

export async function handleListLedger(req: Request, res: Response): Promise<Response> {
  const query = (req as unknown as { valid: { query: ListLedgerQuery } }).valid.query;
  const { rows, totalItems, page, pageSize } = await batchService.listLedger(query);

  return okList(res, {
    code: SUCCESS_CODES.LEDGER_ENTRIES_LISTED,
    message: 'Stock ledger entries listed successfully',
    data: rows,
    page,
    pageSize,
    totalItems,
  });
}
