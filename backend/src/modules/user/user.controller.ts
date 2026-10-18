import type { Request, Response } from 'express';
import * as userService from './user.service.js';
import { created, ok, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function createUser(req: Request, res: Response) {
  const result = await userService.createUser(req.valid.body, req.user!.userId);

  return created(res, {
    code: SUCCESS_CODES.USER_CREATED,
    message: 'User created successfully',
    data: result,
  });
}

export async function listUsers(req: Request, res: Response) {
  const { rows, totalItems } = await userService.listUsers(req.valid.query);

  return okList(res, {
    code: SUCCESS_CODES.USERS_LISTED,
    message: 'Users listed successfully',
    data: rows,
    page: req.valid.query.page || 1,
    pageSize: req.valid.query.pageSize || 20,
    totalItems,
  });
}

export async function getUserById(req: Request, res: Response) {
  const user = await userService.getUserById(req.valid.params.userId);

  return ok(res, {
    code: SUCCESS_CODES.USER_FETCHED,
    message: 'User retrieved successfully',
    data: user,
  });
}

export async function updateUser(req: Request, res: Response) {
  const user = await userService.updateUser(req.valid.params.userId, req.valid.body, req.user!);

  return ok(res, {
    code: SUCCESS_CODES.USER_UPDATED,
    message: 'User updated successfully',
    data: user,
  });
}

export async function resetPassword(req: Request, res: Response) {
  const result = await userService.resetPassword(req.valid.params.userId, req.user!);

  return ok(res, {
    code: SUCCESS_CODES.PASSWORD_RESET,
    message: 'Temporary password generated successfully',
    data: result,
  });
}
