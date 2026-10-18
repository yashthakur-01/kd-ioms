import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, setAccessToken } from '../client';
import { ApiError } from '../api-error';

describe('Frontend API Client (apiFetch)', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('prefixes /api/v1 and parses standard success envelope', async () => {
    const mockResponse = {
      success: true,
      code: 'HEALTH_OK',
      message: 'System healthy',
      data: { status: 'ok' },
      meta: {
        requestId: 'req_12345',
        timestamp: '2026-10-18T10:00:00.000Z',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiFetch<{ status: string }>('/health');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(res.data.status).toBe('ok');
    expect(res.meta.requestId).toBe('req_12345');
  });

  it('attaches Authorization Bearer token when accessToken is set', async () => {
    setAccessToken('mock-jwt-token');

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        code: 'USER_FETCHED',
        data: { id: 'u1' },
        meta: { requestId: 'req_1' },
      }),
    });

    await apiFetch<{ id: string }>('/users/me');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/users/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-jwt-token',
        }),
      })
    );
  });

  it('throws typed ApiError with status, code, and requestId on error envelope', async () => {
    const errorPayload = {
      success: false,
      code: 'INSUFFICIENT_STOCK',
      message: 'Not enough stock available',
      errors: [{ field: 'items[0].quantity', code: 'MAX_EXCEEDED', message: 'Only 2 available' }],
      meta: {
        requestId: 'req_err_999',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => errorPayload,
    });

    try {
      await apiFetch('/orders', { method: 'POST' });
      expect.unreachable('Should have thrown ApiError');
    } catch (err: unknown) {
      const error = err as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(409);
      expect(error.code).toBe('INSUFFICIENT_STOCK');
      expect(error.requestId).toBe('req_err_999');
      expect(error.errors).toHaveLength(1);
    }
  });
});
