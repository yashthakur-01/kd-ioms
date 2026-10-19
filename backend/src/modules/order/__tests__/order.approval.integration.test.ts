import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';
import { ORDER_STATUS } from '../../../enums/order-status.enum.js';

describe('Order Approval and Rejection Integration Endpoints (/api/v1/orders/:orderId/approve & reject)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const retailerId = '22222222-2222-4222-a222-222222222222';
  const deliveryId = '33333333-3333-4333-a333-333333333333';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin_user',
    role: 'ADMIN',
    phone: '9999999999',
    mustChangePassword: false,
  });

  const retailerToken = tokensUtils.signAccessToken({
    sub: retailerId,
    username: 'retailer_user',
    role: 'RETAILER',
    phone: '9888888888',
    mustChangePassword: false,
  });

  const deliveryToken = tokensUtils.signAccessToken({
    sub: deliveryId,
    username: 'delivery_user',
    role: 'DELIVERY',
    phone: '9777777777',
    mustChangePassword: false,
  });

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
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  });

  describe('Authentication & Authorization Guards', () => {
    it('returns 401 when unauthenticated on approve endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when non-admin role (RETAILER) attempts approve', async () => {
      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 403 when non-admin role (DELIVERY) attempts approve', async () => {
      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 403 when non-admin role (RETAILER) attempts reject', async () => {
      const res = await request(app)
        .post('/api/v1/orders/1/reject')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ reason: 'Out of stock at distributor' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('POST /api/v1/orders/:orderId/approve - Validation & Business Logic', () => {
    it('returns 400 when picks payload is empty or zero total quantity', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 10, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [] }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toContain('zero picked items');
    });

    it('returns 404 when order does not exist', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 409 when order is not in PLACED status', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'APPROVED' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });

    it('returns 422 PICK_EXCEEDS_REQUESTED when picked quantity > requested quantity', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 5, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 6, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.PICK_EXCEEDS_REQUESTED);
    });

    it('returns 422 BATCH_MEDICINE_MISMATCH when picked batch does not match order item medicine', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 5, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [{
                batch_id: 10,
                medicine_id: 999, // mismatch
                status: 'ACTIVE',
                expiry_date: '2027-12-31',
                quantity_on_hand: 50,
                selling_price: '80.00',
                mrp: '120.00',
                gst_rate: '12.00',
                price_incl_gst: '89.60',
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.BATCH_MEDICINE_MISMATCH);
    });

    it('returns 422 BATCH_BLOCKED when picked batch is blocked/recalled', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 5, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [{
                batch_id: 10,
                medicine_id: 101,
                status: 'BLOCKED',
                expiry_date: '2027-12-31',
                quantity_on_hand: 50,
                selling_price: '80.00',
                mrp: '120.00',
                gst_rate: '12.00',
                price_incl_gst: '89.60',
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.BATCH_BLOCKED);
    });

    it('returns 422 BATCH_EXPIRED when picked batch is expired', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 5, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [{
                batch_id: 10,
                medicine_id: 101,
                status: 'ACTIVE',
                expiry_date: '2026-01-01', // Expired
                quantity_on_hand: 50,
                selling_price: '80.00',
                mrp: '120.00',
                gst_rate: '12.00',
                price_incl_gst: '89.60',
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.BATCH_EXPIRED);
    });

    it('returns 422 PICK_EXCEEDS_ON_HAND when picked quantity > quantity_on_hand', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 10, quoted_price_incl_gst: '100.00' }], rowCount: 1 };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [{
                batch_id: 10,
                medicine_id: 101,
                status: 'ACTIVE',
                expiry_date: '2027-12-31',
                quantity_on_hand: 3, // only 3 available
                selling_price: '80.00',
                mrp: '120.00',
                gst_rate: '12.00',
                price_incl_gst: '89.60',
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.PICK_EXCEEDS_ON_HAND);
    });

    it('returns 422 PRICE_EXCEEDS_QUOTE when batch price incl GST > quotedPriceInclGst', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return { rows: [{ order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 5, quoted_price_incl_gst: '80.00' }], rowCount: 1 };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }], rowCount: 1 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [{
                batch_id: 10,
                medicine_id: 101,
                status: 'ACTIVE',
                expiry_date: '2027-12-31',
                quantity_on_hand: 20,
                selling_price: '85.00',
                mrp: '120.00',
                gst_rate: '12.00',
                price_incl_gst: '95.20', // > 80.00 quote
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ picks: [{ orderItemId: 1, allocations: [{ batchId: 10, quantity: 5, captureMethod: 'MANUAL' }] }] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.PRICE_EXCEEDS_QUOTE);
    });

    it('approves order successfully with single/multi-batch picks and OUTWARD ledger entries', async () => {
      const executedSqls: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedSqls.push(sql);
          if (sql.includes('SELECT order_id, order_number, status') && sql.includes('FOR UPDATE')) {
            return { rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED' }], rowCount: 1 };
          }
          if (sql.includes('FROM order_items')) {
            return {
              rows: [
                { order_item_id: 1, order_id: 1, medicine_id: 101, requested_quantity: 10, quoted_price_incl_gst: '100.00' },
                { order_item_id: 2, order_id: 1, medicine_id: 102, requested_quantity: 5, quoted_price_incl_gst: '50.00' },
              ],
              rowCount: 2,
            };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }, { batch_id: 11 }, { batch_id: 20 }], rowCount: 3 };
          }
          if (sql.includes('FROM batches b') && sql.includes('JOIN medicines m')) {
            return {
              rows: [
                {
                  batch_id: 10,
                  medicine_id: 101,
                  status: 'ACTIVE',
                  expiry_date: '2027-06-30',
                  quantity_on_hand: 6,
                  selling_price: '80.00',
                  mrp: '100.00',
                  gst_rate: '12.00',
                  price_incl_gst: '89.60',
                },
                {
                  batch_id: 11,
                  medicine_id: 101,
                  status: 'ACTIVE',
                  expiry_date: '2027-12-31',
                  quantity_on_hand: 20,
                  selling_price: '80.00',
                  mrp: '100.00',
                  gst_rate: '12.00',
                  price_incl_gst: '89.60',
                },
                {
                  batch_id: 20,
                  medicine_id: 102,
                  status: 'ACTIVE',
                  expiry_date: '2027-10-31',
                  quantity_on_hand: 3, // only 3 of 5 requested
                  selling_price: '40.00',
                  mrp: '60.00',
                  gst_rate: '5.00',
                  price_incl_gst: '42.00',
                },
              ],
              rowCount: 3,
            };
          }
          if (sql.includes('today_ist()')) {
            return { rows: [{ today: '2026-10-20' }], rowCount: 1 };
          }
          if (sql.includes('INSERT INTO order_allocations')) {
            return { rows: [{ allocation_id: 100 }], rowCount: 1 };
          }
          // Stock ledger lock
          if (sql.includes('SELECT batch_id, quantity_on_hand, status, expiry_date FROM batches WHERE batch_id = $1 FOR UPDATE')) {
            const batchId = params?.[0];
            const qoh = batchId === 10 ? 6 : batchId === 11 ? 20 : 3;
            return { rows: [{ batch_id: batchId, quantity_on_hand: qoh, status: 'ACTIVE', expiry_date: '2027-12-31' }], rowCount: 1 };
          }
          if (sql.includes('UPDATE batches SET quantity_on_hand = $1')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO stock_ledger_entries')) {
            return { rows: [{ entry_id: 501 }], rowCount: 1 };
          }
          if (sql.includes('UPDATE order_items')) {
            return { rowCount: 1 };
          }
          if (sql.includes('UPDATE orders')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          picks: [
            {
              orderItemId: 1, // 10 requested, 6 from batch 10, 4 from batch 11 -> FULL
              allocations: [
                { batchId: 10, quantity: 6, captureMethod: 'SCAN_CAMERA', scannedPayload: '01089012345678901727063010B10' },
                { batchId: 11, quantity: 4, captureMethod: 'MANUAL' },
              ],
            },
            {
              orderItemId: 2, // 5 requested, 3 from batch 20 -> PARTIAL (2 shortfall permanently dropped)
              allocations: [
                { batchId: 20, quantity: 3, captureMethod: 'SCAN_GUN', scannedPayload: 'B20' },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDER_APPROVED);
      expect(res.body.data.orderId).toBe(1);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.items).toHaveLength(2);

      const line1 = res.body.data.items[0];
      expect(line1.orderItemId).toBe(1);
      expect(line1.requestedQuantity).toBe(10);
      expect(line1.pickedQuantity).toBe(10);
      expect(line1.fulfilmentStatus).toBe('FULL');
      expect(line1.allocations).toHaveLength(2);

      const line2 = res.body.data.items[1];
      expect(line2.orderItemId).toBe(2);
      expect(line2.requestedQuantity).toBe(5);
      expect(line2.pickedQuantity).toBe(3);
      expect(line2.fulfilmentStatus).toBe('PARTIAL');
      expect(line2.allocations).toHaveLength(1);

      // Verify ledger entries were recorded with OUTWARD
      const outwardInserts = executedSqls.filter((s) => s.includes('INSERT INTO stock_ledger_entries'));
      expect(outwardInserts.length).toBe(3); // 3 allocations
    });
  });

  describe('POST /api/v1/orders/:orderId/reject - PLACED and APPROVED Orders', () => {
    it('returns 400 when rejection reason is missing or too short', async () => {
      const res = await request(app)
        .post('/api/v1/orders/1/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Bad' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects a PLACED order cleanly without touching ledger', async () => {
      const executedSqls: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedSqls.push(sql);
          if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ order_id: 1, order_number: 'ORD-1001', status: 'PLACED', delivery_partner_id: null }],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE orders')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/1/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Pharmacy credit limit exceeded' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDER_REJECTED);
      expect(res.body.data.orderId).toBe(1);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('Pharmacy credit limit exceeded');

      // No ledger updates should have been executed
      const ledgerInserts = executedSqls.filter((s) => s.includes('stock_ledger_entries'));
      expect(ledgerInserts.length).toBe(0);
    });

    it('rejects an unclaimed APPROVED order with RESTOCK ledger restorations', async () => {
      const executedSqls: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedSqls.push(sql);
          if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ order_id: 2, order_number: 'ORD-1002', status: 'APPROVED', delivery_partner_id: null }],
              rowCount: 1,
            };
          }
          if (sql.includes('FROM order_allocations oa') && sql.includes('JOIN order_items oi')) {
            return {
              rows: [
                { allocation_id: 50, batch_id: 10, order_item_id: 1, quantity: 6 },
                { allocation_id: 51, batch_id: 11, order_item_id: 1, quantity: 4 },
              ],
              rowCount: 2,
            };
          }
          if (sql.includes('ORDER BY batch_id ASC FOR UPDATE')) {
            return { rows: [{ batch_id: 10 }, { batch_id: 11 }], rowCount: 2 };
          }
          // Batch lock for RESTOCK in applyLedgerEntry
          if (sql.includes('SELECT batch_id, quantity_on_hand, status, expiry_date FROM batches WHERE batch_id = $1 FOR UPDATE')) {
            const batchId = params?.[0];
            return { rows: [{ batch_id: batchId, quantity_on_hand: 10, status: 'ACTIVE', expiry_date: '2027-12-31' }], rowCount: 1 };
          }
          if (sql.includes('UPDATE batches SET quantity_on_hand = $1')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO stock_ledger_entries')) {
            return { rows: [{ entry_id: 601 }], rowCount: 1 };
          }
          if (sql.includes('UPDATE orders')) {
            return { rowCount: 1 };
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/2/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Retailer cancelled over phone before dispatch' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ORDER_REJECTED);
      expect(res.body.data.orderId).toBe(2);
      expect(res.body.data.status).toBe('REJECTED');

      // Verify RESTOCK ledger entries
      const restockInserts = executedSqls.filter((s) => s.includes('INSERT INTO stock_ledger_entries'));
      expect(restockInserts.length).toBe(2);
    });

    it('returns 409 INVALID_STATE_TRANSITION when trying to reject an order already claimed by delivery partner', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ order_id: 3, order_number: 'ORD-1003', status: 'APPROVED', delivery_partner_id: 'some-delivery-agent-uuid' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/3/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Too late to reject' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
      expect(res.body.message).toContain('already claimed by delivery partner');
    });

    it('returns 409 INVALID_STATE_TRANSITION when trying to reject a DELIVERED order', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ order_id: 4, order_number: 'ORD-1004', status: 'DELIVERED', delivery_partner_id: 'some-delivery-agent-uuid' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/orders/4/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Already delivered' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });
  });
});
