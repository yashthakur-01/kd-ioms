import type { ListBatchesParams, ListLedgerParams } from './types';

export const batchesKeys = {
  all: ['batches'] as const,
  lists: () => [...batchesKeys.all, 'list'] as const,
  list: (params: ListBatchesParams) => [...batchesKeys.lists(), params] as const,
  details: () => [...batchesKeys.all, 'detail'] as const,
  detail: (id: number) => [...batchesKeys.details(), id] as const,
};

export const ledgerKeys = {
  all: ['stock-ledger'] as const,
  lists: () => [...ledgerKeys.all, 'list'] as const,
  list: (params: ListLedgerParams) => [...ledgerKeys.lists(), params] as const,
};
