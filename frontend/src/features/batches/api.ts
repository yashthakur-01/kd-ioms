import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  BatchRecord,
  BatchDetailRecord,
  GlobalLedgerRecord,
  ListBatchesParams,
  ListLedgerParams,
  UpdateBatchPayload,
  AdjustBatchPayload,
} from './types';

export async function fetchBatches(
  params: ListBatchesParams = {}
): Promise<ApiResponse<BatchRecord[]>> {
  return apiFetch<BatchRecord[]>('/batches', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchBatchById(batchId: number): Promise<BatchDetailRecord> {
  const res = await apiFetch<BatchDetailRecord>(`/batches/${batchId}`);
  return res.data;
}

export async function updateBatch(
  batchId: number,
  payload: UpdateBatchPayload
): Promise<BatchRecord> {
  const res = await apiFetch<BatchRecord>(`/batches/${batchId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function adjustBatch(
  batchId: number,
  payload: AdjustBatchPayload
): Promise<{
  batch: BatchRecord;
  ledgerEntry: {
    entryId: number;
    batchId: number;
    type: string;
    delta: number;
    balanceAfter: number;
    reason: string | null;
  };
}> {
  const res = await apiFetch<{
    batch: BatchRecord;
    ledgerEntry: {
      entryId: number;
      batchId: number;
      type: string;
      delta: number;
      balanceAfter: number;
      reason: string | null;
    };
  }>(`/batches/${batchId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchStockLedger(
  params: ListLedgerParams = {}
): Promise<ApiResponse<GlobalLedgerRecord[]>> {
  return apiFetch<GlobalLedgerRecord[]>('/stock/ledger', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}
