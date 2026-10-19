export const retailerKeys = {
  all: ['retailers'] as const,
  me: () => [...retailerKeys.all, 'me'] as const,
  lists: () => [...retailerKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...retailerKeys.lists(), params] as const,
  details: () => [...retailerKeys.all, 'detail'] as const,
  detail: (userId: string) => [...retailerKeys.details(), userId] as const,
};
