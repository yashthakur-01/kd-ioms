import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchDeliveryPool,
  claimDeliveryOrder,
  releaseDeliveryOrder,
  overrideDeliveryOrder,
  fetchPartnerDeliveries,
  fetchDeliveryOrderDetail,
  completeDeliveryOrder,
} from '../delivery.api';

describe('Frontend Delivery API Client (Plan 8-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchDeliveryPool queries /delivery/pool with pagination params', async () => {
    const mockRes = {
      success: true,
      code: 'DELIVERY_POOL_RETRIEVED',
      data: [{ orderId: 101, orderNumber: 'ORD-101' }],
      meta: { page: 1, pageSize: 20 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockRes,
    });

    const res = await fetchDeliveryPool({ page: 2, pageSize: 15 });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/pool?page=2&pageSize=15',
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].orderId).toBe(101);
  });

  it('claimDeliveryOrder posts to /delivery/orders/:id/claim', async () => {
    const mockRes = {
      success: true,
      code: 'ORDER_CLAIMED',
      data: { orderId: 101, status: 'OUT_FOR_DELIVERY' },
      meta: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockRes,
    });

    const res = await claimDeliveryOrder(101);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders/101/claim',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.data.status).toBe('OUT_FOR_DELIVERY');
  });

  it('releaseDeliveryOrder posts reason to /delivery/orders/:id/release', async () => {
    const mockRes = {
      success: true,
      code: 'ORDER_RELEASED',
      data: { orderId: 101, status: 'APPROVED' },
      meta: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockRes,
    });

    await releaseDeliveryOrder(101, 'Vehicle issue');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders/101/release',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Vehicle issue' }),
      })
    );
  });

  it('overrideDeliveryOrder posts target partner and reason', async () => {
    const mockRes = {
      success: true,
      code: 'ORDER_OVERRIDDEN',
      data: { orderId: 101, message: 'Overridden' },
      meta: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockRes,
    });

    await overrideDeliveryOrder(101, { targetPartnerId: null, reason: 'Releasing to pool' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders/101/override',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetPartnerId: null, reason: 'Releasing to pool' }),
      })
    );
  });

  it('fetchPartnerDeliveries queries /delivery/orders with status filter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: [], meta: {} }),
    });

    await fetchPartnerDeliveries({ status: 'OUT_FOR_DELIVERY', page: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders?status=OUT_FOR_DELIVERY&page=1&pageSize=20',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchDeliveryOrderDetail fetches /delivery/orders/:id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { orderId: 101 }, meta: {} }),
    });

    await fetchDeliveryOrderDetail(101);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders/101',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('completeDeliveryOrder constructs FormData and posts to complete endpoint', async () => {
    const mockRes = {
      success: true,
      code: 'DELIVERY_COMPLETED',
      data: { orderId: 101, status: 'DELIVERED' },
      meta: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockRes,
    });

    const fakeFile = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
    const decisions = [{ orderItemId: 1, decision: 'ACCEPTED' as const }];

    await completeDeliveryOrder(101, { photo: fakeFile, decisions });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/delivery/orders/101/complete',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });
});
