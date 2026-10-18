import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  SaltRecord,
  SaltSuggestion,
  CreateSaltPayload,
  UpdateSaltPayload,
  ListSaltsParams,
} from './types';

export async function fetchSalts(params: ListSaltsParams = {}): Promise<ApiResponse<SaltRecord[]>> {
  return apiFetch<SaltRecord[]>('/salts', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchSaltSuggestions(q: string): Promise<SaltSuggestion[]> {
  const res = await apiFetch<SaltSuggestion[]>('/salts/suggest', {
    query: { q },
  });
  return res.data;
}

export async function createSalt(payload: CreateSaltPayload): Promise<SaltRecord> {
  const res = await apiFetch<SaltRecord>('/salts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateSalt(saltId: number, payload: UpdateSaltPayload): Promise<SaltRecord> {
  const res = await apiFetch<SaltRecord>(`/salts/${saltId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}
