import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Admin Out-of-Stock Alerts Integration (/api/v1/alerts/out-of-stock)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const deliveryId = '33333333-3333-4333-a333-333333333333';
  const retailerId = '22222222-2222-4222-a222-222222222222';

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

  const retailerToken = tokensUtils.signAccessToken({
    sub: retailerId,
    username: 'retailer',
    role: 'RETAILER',
    phone: '9777777777',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authorization & Access Control', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/alerts/out-of-stock');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 FORBIDDEN when called by RETAILER', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerId, username: 'retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/alerts/out-of-stock')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 403 FORBIDDEN when called by DELIVERY', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryId, username: 'delivery', role: 'DELIVERY', phone: '9888888888', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/alerts/out-of-stock')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 OK and list of out-of-stock medicines when called by ADMIN', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('COUNT(*)::INT AS total') && sql.includes('v_medicine_availability')) {
          return { rows: [{ total: 2 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_medicine_availability') && sql.includes('available_qty = 0')) {
          return {
            rows: [
              {
                medicine_id: 12,
                name: 'Amoxicillin 250mg',
                company: 'Cipla',
                pack_size: '10 Capsules',
                salts_text: 'Amoxicillin (250mg)',
                gst_rate: 12.0,
                on_hand_qty: 0,
                reserved_qty: 0,
                available_qty: 0,
                max_mrp: null,
              },
              {
                medicine_id: 15,
                name: 'Cetirizine 10mg',
                company: 'Dr. Reddy',
                pack_size: '10 Tablets',
                salts_text: 'Cetirizine (10mg)',
                gst_rate: 12.0,
                on_hand_qty: 50,
                reserved_qty: 50,
                available_qty: 0,
                max_mrp: 45.0,
              },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/alerts/out-of-stock?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.ALERTS_LISTED);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].availableQty).toBe(0);
      expect(res.body.data[1].availableQty).toBe(0);
      expect(res.body.meta.pagination.totalItems).toBe(2);
      expect(res.body.meta.pagination.page).toBe(1);
    });
  });
});
