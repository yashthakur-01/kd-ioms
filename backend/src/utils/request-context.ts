import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  actor?: {
    userId: string;
    role: string;
  };
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithContext<T>(store: RequestContextStore, fn: () => T): T {
  return asyncLocalStorage.run(store, fn);
}

export function getRequestContext(): RequestContextStore | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string {
  const store = asyncLocalStorage.getStore();
  return store?.requestId || 'req_system';
}

export function getActor(): { userId?: string; role?: string } {
  const store = asyncLocalStorage.getStore();
  return store?.actor || {};
}
