import { apiFetch, type ApiResponse } from '../../lib/api/client';
import type {
  MedicineRecord,
  CreateMedicinePayload,
  UpdateMedicinePayload,
  ListMedicinesParams,
} from './types';

export async function fetchMedicines(
  params: ListMedicinesParams = {}
): Promise<ApiResponse<MedicineRecord[]>> {
  return apiFetch<MedicineRecord[]>('/medicines', {
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchMedicineById(medicineId: number): Promise<MedicineRecord> {
  const res = await apiFetch<MedicineRecord>(`/medicines/${medicineId}`);
  return res.data;
}

export async function searchMedicines(q: string): Promise<MedicineRecord[]> {
  const res = await apiFetch<MedicineRecord[]>('/medicines/search', {
    query: { q },
  });
  return res.data;
}

export async function createMedicine(payload: CreateMedicinePayload): Promise<MedicineRecord> {
  const res = await apiFetch<MedicineRecord>('/medicines', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateMedicine(
  medicineId: number,
  payload: UpdateMedicinePayload
): Promise<MedicineRecord> {
  const res = await apiFetch<MedicineRecord>(`/medicines/${medicineId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}
