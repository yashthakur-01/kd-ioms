import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inwardStock, resolveScan } from './api';
import type { InwardStockPayload, ScanResolvePayload } from './types';

export function useInwardStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InwardStockPayload) => inwardStock(payload),
    onSuccess: () => {
      // Invalidate batches and ledger caches
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
  });
}

export function useResolveScan() {
  return useMutation({
    mutationFn: (payload: ScanResolvePayload) => resolveScan(payload),
  });
}
