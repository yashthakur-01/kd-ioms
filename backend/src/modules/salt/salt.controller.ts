import type { Request, Response } from 'express';
import * as saltService from './salt.service.js';
import { ok, created, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function listSalts(req: Request, res: Response) {
  const query = (req as unknown as { valid: { query: saltService.ListSaltsQuery } }).valid.query;
  const { rows, totalItems } = await saltService.listSalts(query);

  return okList(res, {
    code: SUCCESS_CODES.SALTS_LISTED,
    message: 'Salts listed successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function suggestSalts(req: Request, res: Response) {
  const { q } = (req as unknown as { valid: { query: { q: string } } }).valid.query;
  const suggestions = await saltService.suggestSalts(q);

  return ok(res, {
    code: SUCCESS_CODES.SALT_SUGGESTIONS,
    message: 'Salt suggestions fetched successfully',
    data: suggestions,
  });
}

export async function createSalt(req: Request, res: Response) {
  const body = (req as unknown as { valid: { body: saltService.CreateSaltInput } }).valid.body;
  const actor = {
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
  };

  const salt = await saltService.createSalt(body, actor);

  return created(res, {
    code: SUCCESS_CODES.SALT_CREATED,
    message: 'Salt created successfully',
    data: salt,
  });
}

export async function updateSalt(req: Request, res: Response) {
  const { saltId } = (req as unknown as { valid: { params: { saltId: number } } }).valid.params;
  const body = (req as unknown as { valid: { body: saltService.UpdateSaltInput } }).valid.body;
  const actor = {
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
  };

  const salt = await saltService.updateSalt(saltId, body, actor);

  return ok(res, {
    code: SUCCESS_CODES.SALT_UPDATED,
    message: 'Salt updated successfully',
    data: salt,
  });
}
