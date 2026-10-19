import type { Request, Response } from 'express';
import * as alertService from './alert.service.js';
import { ok, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';
import type { ListAlertsQuery, DismissAlertParams } from './alert.validation.js';

export async function handleListNearExpiry(req: Request, res: Response): Promise<Response> {
  const query = (req as unknown as { valid: { query: ListAlertsQuery } }).valid.query;
  const { rows, totalItems } = await alertService.listNearExpiry(query);

  return okList(res, {
    code: SUCCESS_CODES.ALERTS_LISTED,
    message: 'Near expiry alerts listed successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function handleListExpired(req: Request, res: Response): Promise<Response> {
  const query = (req as unknown as { valid: { query: ListAlertsQuery } }).valid.query;
  const { rows, totalItems } = await alertService.listExpiredStock(query);

  return okList(res, {
    code: SUCCESS_CODES.ALERTS_LISTED,
    message: 'Expired stock listed successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function handleDismissNearExpiry(req: Request, res: Response): Promise<Response> {
  const { batchId } = (req as unknown as { valid: { params: DismissAlertParams } }).valid.params;
  const updatedBatch = await alertService.dismissNearExpiryAlert(batchId);

  return ok(res, {
    code: SUCCESS_CODES.NEAR_EXPIRY_DISMISSED,
    message: 'Near expiry alert dismissed successfully',
    data: updatedBatch,
  });
}
