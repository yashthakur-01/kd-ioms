import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNearExpiryAlerts,
  fetchExpiredStockAlerts,
  dismissNearExpiryAlert,
  removeExpiredBatch,
} from './api';
import type { ListAlertsParams } from './types';

export const alertsKeys = {
  all: ['alerts'] as const,
  nearExpiry: (params: ListAlertsParams = {}) => ['alerts', 'near-expiry', params] as const,
  expired: (params: ListAlertsParams = {}) => ['alerts', 'expired', params] as const,
  badge: ['alerts', 'badge'] as const,
};

export function useNearExpiryAlerts(params: ListAlertsParams = {}) {
  return useQuery({
    queryKey: alertsKeys.nearExpiry(params),
    queryFn: () => fetchNearExpiryAlerts(params),
  });
}

export function useExpiredStockAlerts(params: ListAlertsParams = {}) {
  return useQuery({
    queryKey: alertsKeys.expired(params),
    queryFn: () => fetchExpiredStockAlerts(params),
  });
}

export function useDismissNearExpiryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: number) => dismissNearExpiryAlert(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });
}

export function useRemoveExpiredBatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, reason }: { batchId: number; reason?: string }) =>
      removeExpiredBatch(batchId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });
}

export function useAlertsBadgeCount() {
  return useQuery({
    queryKey: alertsKeys.badge,
    queryFn: async () => {
      const [nearRes, expRes] = await Promise.all([
        fetchNearExpiryAlerts({ pageSize: 1 }),
        fetchExpiredStockAlerts({ pageSize: 1 }),
      ]);
      const nearTotal = nearRes.meta?.pagination?.totalItems ?? 0;
      const expTotal = expRes.meta?.pagination?.totalItems ?? 0;
      return nearTotal + expTotal;
    },
    refetchInterval: 60_000, // 60 seconds
  });
}
