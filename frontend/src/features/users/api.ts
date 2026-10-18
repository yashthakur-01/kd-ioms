import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type { CreateUserFormValues } from './schema';
import type { AuthUser } from '../../providers/AuthProvider';

export interface UserRecord extends AuthUser {
  phone: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  q?: string;
  sort?: string;
}

export interface CreateUserResponseData {
  user: UserRecord;
  temporaryPassword: string;
}

export interface ResetPasswordResponseData {
  temporaryPassword: string;
}

export async function listUsers(params: ListUsersParams = {}): Promise<ApiResponse<UserRecord[]>> {
  return apiFetch<UserRecord[]>('/users', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function createUser(values: CreateUserFormValues): Promise<CreateUserResponseData> {
  const payload = {
    ...values,
    temporaryPassword: values.temporaryPassword || undefined,
  };
  const res = await apiFetch<CreateUserResponseData>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getUser(userId: string): Promise<UserRecord> {
  const res = await apiFetch<UserRecord>(`/users/${userId}`);
  return res.data;
}

export async function updateUser(
  userId: string,
  payload: { phone?: string; isActive?: boolean }
): Promise<UserRecord> {
  const res = await apiFetch<UserRecord>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function resetPassword(userId: string): Promise<ResetPasswordResponseData> {
  const res = await apiFetch<ResetPasswordResponseData>(`/users/${userId}/reset-password`, {
    method: 'POST',
  });
  return res.data;
}
