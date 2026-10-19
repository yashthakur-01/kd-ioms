import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  RetailerProfileFormData,
  RetailerProfile,
  RetailerRecord,
  RetailerProfileResponse,
  ApprovalStatus,
} from './schema';

export type {
  RetailerProfileFormData,
  RetailerProfile,
  RetailerRecord,
  RetailerProfileResponse,
  ApprovalStatus,
};

export interface ListRetailersParams {
  page?: number;
  pageSize?: number;
  approvalStatus?: ApprovalStatus;
  q?: string;
  sort?: string;
}

export async function fetchMyProfile(): Promise<RetailerProfileResponse> {
  const res = await apiFetch<RetailerProfileResponse>('/retailers/me');
  return res.data;
}

export async function upsertMyProfile(
  dto: RetailerProfileFormData
): Promise<{ profile: RetailerProfile; approvalStatus: ApprovalStatus }> {
  const payload = {
    ...dto,
    email: dto.email?.trim() ? dto.email.trim() : undefined,
    gstin: dto.gstin?.trim() ? dto.gstin.trim().toUpperCase() : undefined,
  };
  const res = await apiFetch<{ profile: RetailerProfile; approvalStatus: ApprovalStatus }>('/retailers/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchRetailers(
  params: ListRetailersParams = {}
): Promise<ApiResponse<RetailerRecord[]>> {
  return apiFetch<RetailerRecord[]>('/retailers', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchRetailerById(userId: string): Promise<RetailerRecord> {
  const res = await apiFetch<RetailerRecord>(`/retailers/${userId}`);
  return res.data;
}

export async function approveRetailer(userId: string): Promise<RetailerRecord> {
  const res = await apiFetch<RetailerRecord>(`/retailers/${userId}/approve`, {
    method: 'POST',
  });
  return res.data;
}

export async function rejectRetailer(userId: string, reason: string): Promise<RetailerRecord> {
  const res = await apiFetch<RetailerRecord>(`/retailers/${userId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.data;
}
