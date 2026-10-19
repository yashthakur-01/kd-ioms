import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type { AppSettings, PatchSettingsInput } from './types';

export async function fetchSettings(): Promise<ApiResponse<AppSettings>> {
  return apiFetch<AppSettings>('/settings');
}

export async function updateSettings(
  payload: PatchSettingsInput
): Promise<ApiResponse<AppSettings>> {
  return apiFetch<AppSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
