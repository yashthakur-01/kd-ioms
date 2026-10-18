import { apiFetch, setAccessToken } from '../../lib/api/client';
import type { LoginFormValues, ChangePasswordFormValues } from './schema';
import type { AuthUser } from '../../providers/AuthProvider';

export interface LoginResponseData {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RefreshResponseData {
  accessToken: string;
  expiresIn: number;
}

export interface ChangePasswordResponseData {
  accessToken: string;
  expiresIn: number;
}

export async function login(payload: LoginFormValues): Promise<LoginResponseData> {
  const res = await apiFetch<LoginResponseData>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function refresh(): Promise<RefreshResponseData> {
  const res = await apiFetch<RefreshResponseData>('/auth/refresh', {
    method: 'POST',
  });
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

export async function changePassword(payload: Omit<ChangePasswordFormValues, 'confirmPassword'>): Promise<ChangePasswordResponseData> {
  const res = await apiFetch<ChangePasswordResponseData>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function getMe(): Promise<AuthUser> {
  const res = await apiFetch<AuthUser>('/auth/me');
  return res.data;
}
