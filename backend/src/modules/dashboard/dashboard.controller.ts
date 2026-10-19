import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';
import { ok } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function handleGetDashboardSummary(_req: Request, res: Response): Promise<Response> {
  const summary = await dashboardService.getDashboardSummary();

  return ok(res, {
    code: SUCCESS_CODES.DASHBOARD_SUMMARY_FETCHED,
    message: 'Dashboard summary fetched successfully',
    data: summary,
  });
}
