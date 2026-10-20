'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDeliveryPool,
  claimDeliveryOrder,
  releaseDeliveryOrder,
  overrideDeliveryOrder,
  fetchPartnerDeliveries,
  fetchDeliveryOrderDetail,
  completeDeliveryOrder,
  type CompleteDeliveryPayload,
} from '@/lib/api/delivery.api';
import { useToast } from '@/providers/ToastProvider';

export function useDeliveryPool(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['delivery-pool', params?.page, params?.pageSize],
    queryFn: async () => {
      const res = await fetchDeliveryPool(params);
      return res;
    },
    refetchInterval: 15000,
  });
}

export function useClaimDelivery() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: (orderId: number) => claimDeliveryOrder(orderId),
    onSuccess: (res) => {
      showSuccess(`Order #${res.data.orderNumber} claimed successfully!`);
      queryClient.invalidateQueries({ queryKey: ['delivery-pool'] });
      queryClient.invalidateQueries({ queryKey: ['partner-deliveries'] });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to claim delivery order');
    },
  });
}

export function useReleaseDelivery() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) =>
      releaseDeliveryOrder(orderId, reason),
    onSuccess: () => {
      showSuccess('Order released back to dispatch pool');
      queryClient.invalidateQueries({ queryKey: ['delivery-pool'] });
      queryClient.invalidateQueries({ queryKey: ['partner-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-detail'] });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to release order');
    },
  });
}

export function useOverrideDelivery() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({
      orderId,
      targetPartnerId,
      reason,
    }: {
      orderId: number;
      targetPartnerId?: string | null;
      reason: string;
    }) => overrideDeliveryOrder(orderId, { targetPartnerId, reason }),
    onSuccess: () => {
      showSuccess('Order override executed successfully');
      queryClient.invalidateQueries({ queryKey: ['delivery-pool'] });
      queryClient.invalidateQueries({ queryKey: ['partner-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-detail'] });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to execute override');
    },
  });
}

export function usePartnerDeliveries(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['partner-deliveries', params?.status, params?.page, params?.pageSize],
    queryFn: async () => {
      const res = await fetchPartnerDeliveries(params);
      return res;
    },
  });
}

export function useDeliveryOrderDetail(orderId: number) {
  return useQuery({
    queryKey: ['delivery-detail', orderId],
    queryFn: async () => {
      const res = await fetchDeliveryOrderDetail(orderId);
      return res.data;
    },
    enabled: Number.isInteger(orderId) && orderId > 0,
  });
}

export function useCompleteDelivery() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: CompleteDeliveryPayload;
    }) => completeDeliveryOrder(orderId, payload),
    onSuccess: (res) => {
      const isDelivered = res.data.status === 'DELIVERED';
      if (isDelivered) {
        showSuccess(`Delivery for order #${res.data.orderNumber} completed!`);
      } else {
        showSuccess(`Order #${res.data.orderNumber} rejected at doorstep.`);
      }
      queryClient.invalidateQueries({ queryKey: ['partner-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', res.data.orderId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-pool'] });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to submit delivery completion');
    },
  });
}
