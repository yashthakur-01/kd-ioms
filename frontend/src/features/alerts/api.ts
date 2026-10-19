import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  NearExpiryAlertItem,
  ExpiredStockItem,
  ListAlertsParams,
} from './types';

export async function fetchNearExpiryAlerts(
  params: ListAlertsParams = {}
): Promise<ApiResponse<NearExpiryAlertItem[]>> {
  return apiFetch<NearExpiryAlertItem[]>('/alerts/near-expiry', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchExpiredStockAlerts(
  params: ListAlertsParams = {}
): Promise<ApiResponse<ExpiredStockItem[]>> {
  return apiFetch<ExpiredStockItem[]>('/alerts/expired', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function dismissNearExpiryAlert(batchId: number): Promise<NearExpiryAlertItem> {
  const res = await apiFetch<NearExpiryAlertItem>(`/alerts/near-expiry/${batchId}/dismiss`, {
    method: 'POST',
  });
  return res.data;
}

export async function removeExpiredBatch(
  batchId: number,
  payload?: { reason?: string }
): Promise<{ batchId: number; removedQuantity: number; balanceAfter: number }> {
  const res = await apiFetch<{ batchId: number; removedQuantity: number; balanceAfter: number }>(
    `/batches/${batchId}/remove-expired`,
    {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
  return res.data;
}
