import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';
import { ORDER_STATUS } from '../../../enums/order-status.enum.js';
import { computeRequestHash } from '../../../middleware/idempotency.js';

describe('Order Integration Endpoints (/api/v1/orders)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const deliveryId = '33333333-3333-4333-a333-333333333333';
  const retailerAId = '22222222-2222-4222-a222-222222222222';
  const retailerBId = '77777777-7777-4777-a777-777777777777';
  const pendingRetailerId = '44444444-4444-4444-a444-444444444444';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin',
    role: 'ADMIN',
    phone: '9999999999',
    mustChangePassword: false,
  });

  const deliveryToken = tokensUtils.signAccessToken({
    sub: deliveryId,
    username: 'delivery',
    role: 'DELIVERY',
    phone: '9888888888',
    mustChangePassword: false,
  });

  const retailerAToken = tokensUtils.signAccessToken({
    sub: retailerAId,
    username: 'retailer_a',
    role: 'RETAILER',
    phone: '9777777777',
    mustChangePassword: false,
  });

  const retailerBToken = tokensUtils.signAccessToken({
    sub: retailerBId,
    username: 'retailer_b',
    role: 'RETAILER',
    phone: '9666666666',
    mustChangePassword: false,
  });

  const pendingRetailerToken = tokensUtils.signAccessToken({
    sub: pendingRetailerId,
    username: 'pending_retailer',
    role: 'RETAILER',
    phone: '9555555555',
    mustChangePassword: false,
  });

  const sampleIdempotencyKey = 'a0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        const id = params?.[0];
        const role = id === adminId ? 'ADMIN' : id === deliveryId ? 'DELIVERY' : 'RETAILER';
        return {
          rows: [{ id, username: 'testuser', role, phone: '9999999999', is_active: true, must_change_password: false }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
        const id = params?.[0];
        const status = id === pendingRetailerId ? 'PENDING' : 'APPROVED';
        return {
          rows: [{ approval_status: status }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  });

  describe('Order Placement - Auth & Validation Guards', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).post('/api/v1/orders');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 400 when Idempotency-Key header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .send({ items: [{ medicineId: 1, quantity: 5, quotedPriceInclGst: '100.00' }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toContain('Idempotency-Key');
    });

    it('returns 403 RETAILER_NOT_APPROVED when placed by pending retailer', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: pendingRetailerId, username: 'pending_retailer', role: 'RETAILER', phone: '9555555555', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'PENDING' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${pendingRetailerToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({ items: [{ medicineId: 1, quantity: 5, quotedPriceInclGst: '100.00' }] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
    });

    it('returns 400 VALIDATION_ERROR when order items contain duplicate medicine IDs', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({
          items: [
            { medicineId: 1, quantity: 2, quotedPriceInclGst: '100.00' },
            { medicineId: 1, quantity: 3, quotedPriceInclGst: '100.00' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('Order Placement - Stock Shortage & Price Protection', () => {
    it('returns 409 INSUFFICIENT_STOCK with shortage details when requested quantity > available quantity', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT medicine_id FROM medicines')) {
            return { rows: [{ medicine_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b')) {
            // Only 5 units on hand
            return {
              rows: [{ medicine_id: 10, on_hand_qty: 5, max_price_incl_gst: '150.00' }],
              rowCount: 1,
            };
          }
          if (sql.includes('FROM order_items oi')) {
            // 2 units already reserved in PLACED orders -> net available = 3
            return {
              rows: [{ medicine_id: 10, reserved_qty: 2 }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({
          items: [{ medicineId: 10, quantity: 7, quotedPriceInclGst: '150.00' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
      expect(res.body.details.items).toEqual([
        { medicineId: 10, requested: 7, available: 3 },
      ]);
    });

    it('returns 409 PRICE_CHANGED when quotedPriceInclGst is lower than current catalog maximum', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT medicine_id FROM medicines')) {
            return { rows: [{ medicine_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b')) {
            // Current catalog maximum is 200.00
            return {
              rows: [{ medicine_id: 10, on_hand_qty: 100, max_price_incl_gst: '200.00' }],
              rowCount: 1,
            };
          }
          if (sql.includes('FROM order_items oi')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      // Retailer quotes 180.00 (below 200.00)
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({
          items: [{ medicineId: 10, quantity: 2, quotedPriceInclGst: '180.00' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.PRICE_CHANGED);
    });
  });

  describe('Order Placement - Successful Creation & Idempotent Replay', () => {
    it('successfully places order with 201 Created and persists idempotency key', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT medicine_id FROM medicines')) {
            return { rows: [{ medicine_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b')) {
            return {
              rows: [{ medicine_id: 10, on_hand_qty: 50, max_price_incl_gst: '100.00' }],
              rowCount: 1,
            };
          }
          if (sql.includes('FROM order_items oi') && sql.includes("status = 'PLACED'")) {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes("next_document_number('ORD')")) {
            return { rows: [{ order_number: 'ORD-000001' }], rowCount: 1 };
          }
          if (sql.includes('INSERT INTO orders')) {
            return {
              rows: [
                {
                  order_id: 1,
                  order_number: 'ORD-000001',
                  retailer_id: retailerAId,
                  status: ORDER_STATUS.PLACED,
                  note: 'Deliver at back door',
                  created_at: new Date('2026-10-19T10:00:00Z'),
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('INSERT INTO order_items')) {
            return {
              rows: [
                {
                  order_item_id: 101,
                  medicine_id: 10,
                  requested_quantity: 4,
                  quoted_price_incl_gst: '100.00',
                  fulfilment_status: 'NONE',
                  delivery_status: 'PENDING',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO idempotency_keys')) {
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({
          note: 'Deliver at back door',
          items: [{ medicineId: 10, quantity: 4, quotedPriceInclGst: '100.00' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDER_PLACED);
      expect(res.body.data.orderNumber).toBe('ORD-000001');
      expect(res.body.data.status).toBe('PLACED');
      expect(res.body.data.totalAmount).toBe('400.00');
      expect(res.body.data.items).toHaveLength(1);
    });

    it('replays cached response with 200 OK and X-Idempotent-Replay header when re-sent with identical body', async () => {
      const cachedEnvelope = {
        success: true,
        code: SUCCESS_CODES.ORDER_PLACED,
        message: 'Order placed successfully',
        data: {
          orderId: 1,
          orderNumber: 'ORD-000001',
          status: 'PLACED',
          totalAmount: '400.00',
        },
      };

      const requestPayload = {
        items: [{ medicineId: 10, quantity: 4, quotedPriceInclGst: '100.00' }],
      };
      const matchingHash = computeRequestHash(requestPayload);

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return {
            rows: [{
              key: sampleIdempotencyKey,
              user_id: retailerAId,
              request_hash: matchingHash,
              response: cachedEnvelope,
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send(requestPayload);

      expect(res.status).toBe(200);
      expect(res.headers['x-idempotent-replay']).toBe('true');
      expect(res.body.data.orderNumber).toBe('ORD-000001');
    });

    it('returns 409 IDEMPOTENCY_KEY_REUSED when same key is sent with altered payload', async () => {
      const cachedHash = computeRequestHash({ items: [{ medicineId: 10, quantity: 4 }] });

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM idempotency_keys WHERE key = $1')) {
          return {
            rows: [{
              key: sampleIdempotencyKey,
              user_id: retailerAId,
              request_hash: cachedHash,
              response: { orderId: 1 },
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .set('Idempotency-Key', sampleIdempotencyKey)
        .send({ items: [{ medicineId: 10, quantity: 8, quotedPriceInclGst: '100.00' }] });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
    });
  });

  describe('Order Listing & Tenant Isolation (GET /api/v1/orders)', () => {
    it('returns only own orders when called by retailer', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SELECT COUNT(*)::INT AS total FROM orders o')) {
          // Verify retailer_id parameter was forced
          expect(params).toContain(retailerAId);
          return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM orders o')) {
          return {
            rows: [
              {
                order_id: 1,
                order_number: 'ORD-000001',
                status: 'PLACED',
                note: null,
                created_at: new Date('2026-10-19T10:00:00Z'),
                retailer_user_id: retailerAId,
                retailer_username: 'retailer_a',
                pharmacy_name: 'Pharmacy A',
                item_count: 2,
                total_amount: '250.00',
              },
            ],
            rowCount: 1,
            command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDERS_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].orderNumber).toBe('ORD-000001');
    });
  });

  describe('Order Details & Allocation Masking (GET /api/v1/orders/:orderId)', () => {
    it('returns 404 NOT_FOUND when Retailer A queries Retailer B order (Tenant Isolation)', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM orders o')) {
          // Belongs to retailer B!
          return {
            rows: [{
              order_id: 99,
              order_number: 'ORD-000099',
              retailer_id: retailerBId,
              status: 'PLACED',
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/orders/99')
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('masks order_allocations from retailer response', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM orders o')) {
          return {
            rows: [{
              order_id: 1,
              order_number: 'ORD-000001',
              retailer_id: retailerAId,
              status: 'APPROVED',
              created_at: new Date('2026-10-19T10:00:00Z'),
              retailer_username: 'retailer_a',
              pharmacy_name: 'Pharmacy A',
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM order_items oi')) {
          return {
            rows: [{
              order_item_id: 10,
              medicine_id: 1,
              requested_quantity: 2,
              quoted_price_incl_gst: '100.00',
              picked_quantity: 2,
              fulfilment_status: 'FULL',
              delivery_status: 'PENDING',
              medicine_name: 'Augmentin 625',
              company: 'GSK',
              pack_size: '10 Tablets',
              gst_rate: '12.00',
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM order_status_history osh')) {
          return {
            rows: [{
              history_id: 1,
              from_status: null,
              to_status: 'PLACED',
              actor_id: retailerAId,
              note: 'Order placed',
              created_at: new Date('2026-10-19T10:00:00Z'),
              actor_username: 'retailer_a',
              actor_role: 'RETAILER',
            }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/orders/1')
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe('ORD-000001');
      expect(res.body.data.allocations).toBeUndefined(); // Masked!
    });
  });

  describe('Order Cancellation (POST /api/v1/orders/:orderId/cancel)', () => {
    it('cancels order when in PLACED status and records history', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM orders WHERE order_id = $1 FOR UPDATE')) {
            return {
              rows: [{ order_id: 1, retailer_id: retailerAId, status: ORDER_STATUS.PLACED, order_number: 'ORD-000001' }],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE orders')) {
            return {
              rows: [{ order_id: 1, order_number: 'ORD-000001', status: ORDER_STATUS.CANCELLED, cancelled_at: new Date() }],
              rowCount: 1,
            };
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/cancel')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .send({ reason: 'Found stock elsewhere' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDER_CANCELLED);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('rejects cancellation with 409 INVALID_STATE_TRANSITION when order is no longer PLACED', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerAId, username: 'retailer_a', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM orders WHERE order_id = $1 FOR UPDATE')) {
            // Already APPROVED!
            return {
              rows: [{ order_id: 1, retailer_id: retailerAId, status: ORDER_STATUS.APPROVED, order_number: 'ORD-000001' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/cancel')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .send({ reason: 'Trying to cancel approved order' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });
  });

  describe('High Concurrency Race Condition Simulation', () => {
    it('handles two simultaneous orders competing for remaining stock; exactly 1 succeeds and 1 gets 409 INSUFFICIENT_STOCK', async () => {
      let reservedStock = 0;
      const totalOnHand = 10;
      const requestQty = 7;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT medicine_id FROM medicines')) {
              return { rows: [{ medicine_id: 10 }], rowCount: 1 };
            }
            if (sql.includes('FROM batches b')) {
              return {
                rows: [{ medicine_id: 10, on_hand_qty: totalOnHand, max_price_incl_gst: '100.00' }],
                rowCount: 1,
              };
            }
            if (sql.includes('FROM order_items oi') && sql.includes("status = 'PLACED'")) {
              return {
                rows: [{ medicine_id: 10, reserved_qty: reservedStock }],
                rowCount: 1,
              };
            }
            if (sql.includes("next_document_number('ORD')")) {
              return { rows: [{ order_number: 'ORD-000001' }], rowCount: 1 };
            }
            if (sql.includes('INSERT INTO orders')) {
              reservedStock += requestQty;
              return {
                rows: [
                  {
                    order_id: 1,
                    order_number: 'ORD-000001',
                    retailer_id: retailerAId,
                    status: ORDER_STATUS.PLACED,
                    note: null,
                    created_at: new Date(),
                  },
                ],
                rowCount: 1,
              };
            }
            if (sql.includes('INSERT INTO order_items')) {
              return {
                rows: [
                  {
                    order_item_id: 1,
                    medicine_id: 10,
                    requested_quantity: requestQty,
                    quoted_price_incl_gst: '100.00',
                    fulfilment_status: 'NONE',
                    delivery_status: 'PENDING',
                  },
                ],
                rowCount: 1,
              };
            }
            if (sql.includes('INSERT INTO order_status_history') || sql.includes('INSERT INTO idempotency_keys')) {
              return { rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }),
        };
        return callback(mockClient as any);
      });

      const key1 = 'c0000000-0000-4000-8000-000000000001';
      const key2 = 'c0000000-0000-4000-8000-000000000002';

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${retailerAToken}`)
          .set('Idempotency-Key', key1)
          .send({ items: [{ medicineId: 10, quantity: requestQty, quotedPriceInclGst: '100.00' }] }),
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${retailerBToken}`)
          .set('Idempotency-Key', key2)
          .send({ items: [{ medicineId: 10, quantity: requestQty, quotedPriceInclGst: '100.00' }] }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const failedRes = res1.status === 409 ? res1 : res2;
      expect(failedRes.body.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
      expect(failedRes.body.details.items[0]).toEqual({
        medicineId: 10,
        requested: 7,
        available: 3,
      });
    });
  });
});
