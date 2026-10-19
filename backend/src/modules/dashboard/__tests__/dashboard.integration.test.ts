import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Dashboard Summary Integration Endpoints (/api/v1/dashboard)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const retailerId = '22222222-2222-4222-a222-222222222222';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin',
    role: 'ADMIN',
    phone: '9999999999',
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

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
  });

  it('returns 403 when called by non-admin role', async () => {
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
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${retailerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('returns 200 with all 8 operational count figures matching database queries', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    vi.spyOn(db.pool, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM retailers') && sql.includes('verification_status = \'PENDING\'')) {
        return { rows: [{ count: 3 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM orders') && sql.includes('status = \'PLACED\'')) {
        return { rows: [{ count: 5 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM orders') && sql.includes('status = \'APPROVED\'') && sql.includes('claimed_by IS NULL')) {
        return { rows: [{ count: 2 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM orders') && sql.includes('status = \'DISPATCHED\'')) {
        return { rows: [{ count: 4 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM v_expiry_alerts')) {
        return { rows: [{ count: 7 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM v_expired_stock')) {
        return { rows: [{ count: 1 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM v_medicine_availability') && sql.includes('available_qty = 0')) {
        return { rows: [{ count: 8 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM notification_logs') && sql.includes('status = \'FAILED\'')) {
        return { rows: [{ count: 0 }], rowCount: 1 } as any;
      }
      return { rows: [{ count: 0 }], rowCount: 1 } as any;
    });

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code).toBe(SUCCESS_CODES.DASHBOARD_SUMMARY_FETCHED);
    expect(res.body.data).toEqual({
      pendingRetailers: 3,
      placedOrders: 5,
      approvedUnclaimed: 2,
      outForDelivery: 4,
      nearExpiryBatches: 7,
      expiredBatches: 1,
      outOfStockMedicines: 8,
      failedNotifications: 0,
    });
  });
});
