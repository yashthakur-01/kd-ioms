import type { Request, Response } from 'express';
import * as settingsService from './settings.service.js';
import { ok } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function handleGetSettings(_req: Request, res: Response) {
  const settings = await settingsService.getSettings();

  return ok(res, {
    code: SUCCESS_CODES.SETTINGS_FETCHED,
    message: 'Settings fetched successfully',
    data: settings,
  });
}

export async function handlePatchSettings(req: Request, res: Response) {
  const userId = req.user!.userId;
  const settings = await settingsService.updateSettings(req.body, userId);

  return ok(res, {
    code: SUCCESS_CODES.SETTINGS_UPDATED,
    message: 'Settings updated successfully',
    data: settings,
  });
}
