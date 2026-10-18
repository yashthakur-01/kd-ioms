import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  InwardStockPayload,
  InwardStockResult,
  ScanResolvePayload,
  ScanResolveResult,
} from './types';

export async function inwardStock(payload: InwardStockPayload): Promise<ApiResponse<InwardStockResult>> {
  return apiFetch<InwardStockResult>('/stock/inward', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resolveScan(payload: ScanResolvePayload): Promise<ApiResponse<ScanResolveResult>> {
  return apiFetch<ScanResolveResult>('/stock/scan/resolve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
