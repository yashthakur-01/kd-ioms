import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMedicines,
  fetchMedicineById,
  searchMedicines,
  createMedicine,
  updateMedicine,
} from './api';
import type {
  ListMedicinesParams,
  CreateMedicinePayload,
  UpdateMedicinePayload,
} from './types';

export const medicinesKeys = {
  all: ['medicines'] as const,
  lists: () => [...medicinesKeys.all, 'list'] as const,
  list: (params: ListMedicinesParams) => [...medicinesKeys.lists(), params] as const,
  details: () => [...medicinesKeys.all, 'detail'] as const,
  detail: (id: number) => [...medicinesKeys.details(), id] as const,
  search: (q: string) => [...medicinesKeys.all, 'search', q] as const,
};

export function useMedicines(params: ListMedicinesParams = {}) {
  return useQuery({
    queryKey: medicinesKeys.list(params),
    queryFn: () => fetchMedicines(params),
  });
}

export function useMedicine(medicineId: number) {
  return useQuery({
    queryKey: medicinesKeys.detail(medicineId),
    queryFn: () => fetchMedicineById(medicineId),
    enabled: Boolean(medicineId),
  });
}

export function useSearchMedicines(q: string) {
  return useQuery({
    queryKey: medicinesKeys.search(q),
    queryFn: () => searchMedicines(q),
    enabled: q.trim().length >= 2,
    staleTime: 1000 * 30, // 30 sec cache for typeahead
  });
}

export function useCreateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMedicinePayload) => createMedicine(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicinesKeys.all });
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      medicineId,
      payload,
    }: {
      medicineId: number;
      payload: UpdateMedicinePayload;
    }) => updateMedicine(medicineId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: medicinesKeys.all });
      queryClient.invalidateQueries({ queryKey: medicinesKeys.detail(variables.medicineId) });
    },
  });
}
