import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSalts, fetchSaltSuggestions, createSalt, updateSalt } from './api';
import type { ListSaltsParams, CreateSaltPayload, UpdateSaltPayload } from './types';

export const saltsKeys = {
  all: ['salts'] as const,
  lists: () => [...saltsKeys.all, 'list'] as const,
  list: (params: ListSaltsParams) => [...saltsKeys.lists(), params] as const,
  suggestions: (q: string) => [...saltsKeys.all, 'suggest', q] as const,
};

export function useSalts(params: ListSaltsParams = {}) {
  return useQuery({
    queryKey: saltsKeys.list(params),
    queryFn: () => fetchSalts(params),
  });
}

export function useSaltSuggestions(q: string) {
  return useQuery({
    queryKey: saltsKeys.suggestions(q),
    queryFn: () => fetchSaltSuggestions(q),
    enabled: q.trim().length >= 2,
    staleTime: 1000 * 60, // 1 min cache for typeahead
  });
}

export function useCreateSalt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaltPayload) => createSalt(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saltsKeys.all });
    },
  });
}

export function useUpdateSalt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ saltId, payload }: { saltId: number; payload: UpdateSaltPayload }) =>
      updateSalt(saltId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saltsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
  });
}
