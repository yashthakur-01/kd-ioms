import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type { DashboardSummaryData } from './types';

export async function fetchDashboardSummary(): Promise<ApiResponse<DashboardSummaryData>> {
  return apiFetch<DashboardSummaryData>('/dashboard/summary');
}
