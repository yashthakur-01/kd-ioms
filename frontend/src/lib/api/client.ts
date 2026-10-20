import { ApiError } from './api-error';

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    [key: string]: unknown;
  };
  errors?: Array<{
    field?: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        setAccessToken(null);
        return null;
      }

      const json = (await res.json()) as { success: boolean; data?: { accessToken?: string } };
      if (json.success && json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        return json.data.accessToken;
      }

      setAccessToken(null);
      return null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> {
  const { query, idempotencyKey, headers = {}, ...restOptions } = options;

  let url = path.startsWith('/api/v1') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;

  if (query) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (typeof FormData !== 'undefined' && restOptions.body instanceof FormData) {
    delete reqHeaders['Content-Type'];
  }

  if (inMemoryAccessToken) {
    reqHeaders['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  if (idempotencyKey) {
    reqHeaders['Idempotency-Key'] = idempotencyKey;
  }

  let res = await fetch(url, {
    ...restOptions,
    headers: reqHeaders,
  });

  // Handle expired token with silent refresh once
  if (res.status === 401) {
    const clone = res.clone();
    try {
      const errJson = (await clone.json()) as { code?: string };
      if (errJson?.code === 'AUTH_TOKEN_EXPIRED') {
        const newToken = await refreshAccessToken();
        if (newToken) {
          reqHeaders['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(url, {
            ...restOptions,
            headers: reqHeaders,
          });
        }
      }
    } catch {
      // Ignore JSON parse error on 401 clone
    }
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError({
      status: res.status,
      code: 'INTERNAL_ERROR',
      message: `Failed to parse response from server (${res.status} ${res.statusText})`,
    });
  }

  if (!json.success || res.status >= 400) {
    throw new ApiError({
      status: res.status,
      code: json.code || 'UNKNOWN_ERROR',
      message: json.message || 'Request failed',
      details: (json as { details?: unknown }).details,
      errors: json.errors,
      meta: json.meta,
    });
  }

  return json;
}
