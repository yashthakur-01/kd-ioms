import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { USER_ROLE } from '../../../enums/user-role.enum.js';
import { deliveryService } from '../delivery.service.js';

describe('Delivery Pool & Atomic Claim Endpoints (Plan 8-02)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const retailerId = '22222222-2222-4222-a222-222222222222';
  const deliveryPartnerId = '33333333-3333-4333-a333-333333333333';
  const otherDeliveryPartnerId = '44444444-4444-4444-a444-444444444444';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin_user',
    role: USER_ROLE.ADMIN,
    phone: '9999999999',
    mustChangePassword: false,
  });

  const deliveryToken = tokensUtils.signAccessToken({
    sub: deliveryPartnerId,
    username: 'delivery_partner_1',
    role: USER_ROLE.DELIVERY,
    phone: '9888888888',
    mustChangePassword: false,
  });

  const otherDeliveryToken = tokensUtils.signAccessToken({
    sub: otherDeliveryPartnerId,
    username: 'delivery_partner_2',
    role: USER_ROLE.DELIVERY,
    phone: '9777777777',
    mustChangePassword: false,
  });

  const retailerToken = tokensUtils.signAccessToken({
    sub: retailerId,
    username: 'retailer_user',
    role: USER_ROLE.RETAILER,
    phone: '9666666666',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      // Auth middleware user check
      if (sql.includes('FROM users WHERE id = $1')) {
        const id = params?.[0];
        let role = USER_ROLE.DELIVERY;
        let username = 'delivery_partner_1';
        if (id === adminId) {
          role = USER_ROLE.ADMIN;
          username = 'admin_user';
        } else if (id === retailerId) {
          role = USER_ROLE.RETAILER;
          username = 'retailer_user';
        } else if (id === otherDeliveryPartnerId) {
          username = 'delivery_partner_2';
        }

        return {
          rows: [
            {
              id,
              username,
              role,
              phone: '9999999999',
              is_active: true,
              must_change_password: false,
            },
          ],
          rowCount: 1,
          command: '',
          oid: 0,
          fields: [],
        };
      }

      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  });

  describe('Authorization Guards', () => {
    it('returns 401 when unauthenticated on pool endpoint', async () => {
      const res = await request(app).get('/api/v1/delivery/pool');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when a retailer tries to access the delivery pool', async () => {
      const res = await request(app)
        .get('/api/v1/delivery/pool')
        .set('Authorization', `Bearer ${retailerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows a delivery partner or admin to view the delivery pool', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryPartnerId, username: 'delivery_1', role: USER_ROLE.DELIVERY, is_active: true }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('SELECT COUNT(*)::INT AS total FROM orders WHERE status = \'APPROVED\'')) {
          return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM orders o') && sql.includes('WHERE o.status = \'APPROVED\' AND o.delivery_partner_id IS NULL')) {
          return {
            rows: [
              {
                order_id: 101,
                order_number: 'ORD-000101',
                status: 'APPROVED',
                created_at: new Date('2026-10-20T08:00:00Z'),
                retailer_user_id: retailerId,
                retailer_username: 'apollo_pharmacy',
                user_phone: '9876543210',
                shop_name: 'Apollo Pharmacy',
                city: 'Ahmedabad',
                pincode: '380015',
                item_count: 3,
                total_amount: '1250.00',
                approved_at: new Date('2026-10-20T08:30:00Z'),
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/delivery/pool')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('DELIVERY_POOL_RETRIEVED');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].orderNumber).toBe('ORD-000101');
      expect(res.body.data[0].retailer.shopName).toBe('Apollo Pharmacy');
    });
  });

  describe('POST /api/v1/delivery/orders/:orderId/claim & Concurrency Race', () => {
    it('successfully claims an approved order', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryPartnerId, username: 'delivery_1', role: USER_ROLE.DELIVERY, is_active: true }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('UPDATE orders') && sql.includes('SET status = \'OUT_FOR_DELIVERY\'')) {
          return {
            rows: [{ order_id: 101, order_number: 'ORD-000101', status: 'OUT_FOR_DELIVERY', claimed_at: new Date() }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('INSERT INTO order_status_history')) {
          return { rows: [{ history_id: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
          return {
            rows: [
              {
                order_id: 101,
                order_number: 'ORD-000101',
                status: 'OUT_FOR_DELIVERY',
                note: null,
                claimed_at: new Date(),
                delivered_at: null,
                delivery_photo_path: null,
                rejection_reason: null,
                created_at: new Date(),
                delivery_partner_id: deliveryPartnerId,
                retailer_user_id: retailerId,
                retailer_username: 'apollo',
                user_phone: '9876543210',
                shop_name: 'Apollo Pharmacy',
                address_line: 'CG Road',
                city: 'Ahmedabad',
                state: 'Gujarat',
                pincode: '380015',
                whatsapp_number: '9876543210',
                dp_id: deliveryPartnerId,
                dp_username: 'delivery_partner_1',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('FROM order_items oi')) {
          return {
            rows: [
              {
                order_item_id: 1,
                medicine_id: 10,
                medicine_name: 'Paracetamol',
                company: 'Cipla',
                pack_size: '10 Tablets',
                requested_quantity: 10,
                picked_quantity: 10,
                quoted_price_incl_gst: '25.00',
                delivery_status: 'PENDING',
                refusal_reason: null,
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('FROM order_allocations oa')) {
          return {
            rows: [
              {
                allocation_id: 1,
                order_item_id: 1,
                batch_id: 5,
                batch_number: 'PARA-01',
                expiry_date: '2027-12-31',
                quantity: 10,
                rate: '20.00',
                mrp: '30.00',
                gst_rate: '12.00',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/claim')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('ORDER_CLAIMED');
      expect(res.body.data.status).toBe('OUT_FOR_DELIVERY');
      expect(res.body.data.retailer.shopName).toBe('Apollo Pharmacy');
    });

    it('returns 409 ORDER_ALREADY_CLAIMED when order has already been claimed', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryPartnerId, username: 'delivery_1', role: USER_ROLE.DELIVERY, is_active: true }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('UPDATE orders') && sql.includes('SET status = \'OUT_FOR_DELIVERY\'')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1')) {
          return {
            rows: [{ order_id: 101, status: 'OUT_FOR_DELIVERY', delivery_partner_id: otherDeliveryPartnerId }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/claim')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.ORDER_ALREADY_CLAIMED);
    });

    it('resolves 10 simultaneous claims with exactly 1 success and 9 claiming ORDER_ALREADY_CLAIMED', async () => {
      // Simulate database state for atomic update
      let claimedBy: string | null = null;

      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          const id = params?.[0];
          return {
            rows: [{ id, username: 'partner', role: USER_ROLE.DELIVERY, is_active: true }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }

        if (sql.includes('UPDATE orders') && sql.includes('SET status = \'OUT_FOR_DELIVERY\'')) {
          const partnerId = params?.[0];
          if (claimedBy === null) {
            claimedBy = partnerId;
            return {
              rows: [{ order_id: 200, order_number: 'ORD-000200', status: 'OUT_FOR_DELIVERY', claimed_at: new Date() }],
              rowCount: 1,
              command: '',
              oid: 0,
              fields: [],
            };
          }
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        if (sql.includes('SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1')) {
          return {
            rows: [{ order_id: 200, status: 'OUT_FOR_DELIVERY', delivery_partner_id: claimedBy }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }

        if (sql.includes('INSERT INTO order_status_history')) {
          return { rows: [{ history_id: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }

        if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
          return {
            rows: [
              {
                order_id: 200,
                order_number: 'ORD-000200',
                status: 'OUT_FOR_DELIVERY',
                claimed_at: new Date(),
                created_at: new Date(),
                delivery_partner_id: claimedBy,
                retailer_user_id: retailerId,
                retailer_username: 'apollo',
                shop_name: 'Apollo Pharmacy',
                city: 'Ahmedabad',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }

        if (sql.includes('FROM order_items oi') || sql.includes('FROM order_allocations oa')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      // Execute 10 simultaneous claims
      const partnerIds = Array.from({ length: 10 }, (_, i) => `partner-uuid-${i + 1}`);
      const promises = partnerIds.map((partnerId) =>
        deliveryService.claimOrder({ partnerId, orderId: 200 }).then(
          (res) => ({ success: true, partnerId, res }),
          (err) => ({ success: false, partnerId, err })
        )
      );

      const results = await Promise.all(promises);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(9);
      for (const fail of failures) {
        expect((fail as any).err.code).toBe(ERROR_CODES.ORDER_ALREADY_CLAIMED);
      }
    });
  });

  describe('POST /api/v1/delivery/orders/:orderId/release', () => {
    it('allows the assigned delivery partner to release the order back to pool', async () => {
      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE')) {
              return {
                rows: [{ order_id: 101, status: 'OUT_FOR_DELIVERY', delivery_partner_id: deliveryPartnerId }],
                rowCount: 1,
              };
            }
            if (sql.includes('UPDATE orders') && sql.includes('SET status = \'APPROVED\'')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO order_status_history')) {
              return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/release')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ reason: 'Flat tyre, unable to deliver' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('ORDER_RELEASED');
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('rejects release with 403 when a non-assigned delivery partner attempts it', async () => {
      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE')) {
              return {
                rows: [{ order_id: 101, status: 'OUT_FOR_DELIVERY', delivery_partner_id: deliveryPartnerId }],
                rowCount: 1,
              };
            }
            return { rowCount: 0, rows: [] };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/release')
        .set('Authorization', `Bearer ${otherDeliveryToken}`)
        .send({ reason: 'Attempting unauthorized release' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('POST /api/v1/delivery/orders/:orderId/override', () => {
    it('rejects override with 403 if called by a non-admin user', async () => {
      const res = await request(app)
        .post('/api/v1/delivery/orders/101/override')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ reason: 'Unauthorized override attempt' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows Admin to override and return order to pool', async () => {
      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE')) {
              return {
                rows: [{ order_id: 101, status: 'OUT_FOR_DELIVERY', delivery_partner_id: deliveryPartnerId }],
                rowCount: 1,
              };
            }
            if (sql.includes('UPDATE orders') && sql.includes('SET status = \'APPROVED\'')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO order_status_history')) {
              return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetPartnerId: null, reason: 'Partner phone unreachable, resetting to pool' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('ORDER_OVERRIDDEN');
    });
  });

  describe('GET /api/v1/delivery/orders/:orderId', () => {
    it('returns 403 when a non-assigned delivery partner queries order detail', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: otherDeliveryPartnerId, username: 'delivery_2', role: USER_ROLE.DELIVERY, is_active: true }],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
          return {
            rows: [
              {
                order_id: 101,
                order_number: 'ORD-000101',
                status: 'OUT_FOR_DELIVERY',
                delivery_partner_id: deliveryPartnerId, // Assigned to partner 1, but partner 2 is calling!
                retailer_user_id: retailerId,
                retailer_username: 'apollo',
                shop_name: 'Apollo Pharmacy',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/delivery/orders/101')
        .set('Authorization', `Bearer ${otherDeliveryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });
});
