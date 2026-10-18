import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as retailerApi from './api';
import { retailerKeys } from './keys';
import { useToast } from '../../providers/ToastProvider';
import type { RetailerProfileFormData } from './schema';

export function useRetailerProfile() {
  const query = useQuery({
    queryKey: retailerKeys.me(),
    queryFn: () => retailerApi.fetchMyProfile(),
    refetchOnWindowFocus: true,
    staleTime: 1000 * 30, // 30 seconds fresh cache
  });

  const profile = query.data?.profile ?? null;
  const approvalStatus = query.data?.approvalStatus ?? null;

  return {
    ...query,
    profile,
    approvalStatus,
    isApproved: approvalStatus === 'APPROVED',
    isPending: approvalStatus === 'PENDING',
    isRejected: approvalStatus === 'REJECTED',
    isUnsubmitted: !profile || !approvalStatus,
  };
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (values: RetailerProfileFormData) => retailerApi.upsertMyProfile(values),
    onSuccess: (data) => {
      queryClient.setQueryData(retailerKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: retailerKeys.me() });
      addToast({
        type: 'success',
        title: 'Profile Submitted',
        message: 'Your KYC profile has been submitted for administrative verification.',
      });
    },
  });
}

export function useRetailers(params: retailerApi.ListRetailersParams = {}) {
  return useQuery({
    queryKey: retailerKeys.list(params as Record<string, unknown>),
    queryFn: () => retailerApi.fetchRetailers(params),
  });
}

export function useRetailerDetail(userId: string) {
  return useQuery({
    queryKey: retailerKeys.detail(userId),
    queryFn: () => retailerApi.fetchRetailerById(userId),
    enabled: Boolean(userId),
  });
}

export function useApproveRetailer() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (userId: string) => retailerApi.approveRetailer(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: retailerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: retailerKeys.detail(data.userId) });
      addToast({
        type: 'success',
        title: 'Retailer Approved',
        message: `${data.shopName} has been approved successfully.`,
      });
    },
  });
}

export function useRejectRetailer() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      retailerApi.rejectRetailer(userId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: retailerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: retailerKeys.detail(data.userId) });
      addToast({
        type: 'warning',
        title: 'Application Rejected',
        message: `Application for ${data.shopName} has been marked as rejected.`,
      });
    },
  });
}
