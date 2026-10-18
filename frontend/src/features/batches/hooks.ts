import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBatches,
  fetchBatchById,
  updateBatch,
  adjustBatch,
  fetchStockLedger,
} from './api';
import { batchesKeys, ledgerKeys } from './keys';
import type {
  ListBatchesParams,
  ListLedgerParams,
  UpdateBatchPayload,
  AdjustBatchPayload,
} from './types';

export function useBatches(params: ListBatchesParams = {}) {
  return useQuery({
    queryKey: batchesKeys.list(params),
    queryFn: () => fetchBatches(params),
  });
}

export function useBatch(batchId: number) {
  return useQuery({
    queryKey: batchesKeys.detail(batchId),
    queryFn: () => fetchBatchById(batchId),
    enabled: Boolean(batchId),
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: number; payload: UpdateBatchPayload }) =>
      updateBatch(batchId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: batchesKeys.all });
      queryClient.invalidateQueries({ queryKey: batchesKeys.detail(variables.batchId) });
    },
  });
}

export function useAdjustBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: number; payload: AdjustBatchPayload }) =>
      adjustBatch(batchId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: batchesKeys.all });
      queryClient.invalidateQueries({ queryKey: batchesKeys.detail(variables.batchId) });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}

export function useStockLedger(params: ListLedgerParams = {}) {
  return useQuery({
    queryKey: ledgerKeys.list(params),
    queryFn: () => fetchStockLedger(params),
  });
}
