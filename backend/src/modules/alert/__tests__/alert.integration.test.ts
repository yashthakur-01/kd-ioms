import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Alerts & Expiry Removal Integration Endpoints', () => {
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

  describe('GET /api/v1/alerts/near-expiry', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/alerts/near-expiry');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when called by non-admin', async () => {
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
        .get('/api/v1/alerts/near-expiry')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with paginated near-expiry items', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM v_expiry_alerts')) {
          return {
            rows: [
              {
                batch_id: 101,
                medicine_id: 5,
                medicine_name: 'Paracetamol 500mg',
                batch_number: 'BATCH-2026-A',
                expiry_date: '2026-11-15',
                days_left: 27,
                quantity_on_hand: 120,
                mrp: '45.00',
                selling_price: '38.00',
                full_count: '1',
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/alerts/near-expiry')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.ALERTS_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].batchNumber).toBe('BATCH-2026-A');
      expect(res.body.data[0].daysLeft).toBe(27);
    });
  });

  describe('GET /api/v1/alerts/expired', () => {
    it('returns 200 with paginated expired items', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM v_expired_stock')) {
          return {
            rows: [
              {
                batch_id: 102,
                medicine_id: 6,
                medicine_name: 'Amoxicillin 250mg',
                batch_number: 'BATCH-2025-X',
                expiry_date: '2026-09-01',
                days_expired: 48,
                quantity_on_hand: 50,
                mrp: '60.00',
                selling_price: '50.00',
                full_count: '1',
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/alerts/expired')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.ALERTS_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].daysExpired).toBe(48);
    });
  });

  describe('POST /api/v1/alerts/near-expiry/:batchId/dismiss', () => {
    it('returns 404 if batch does not exist', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM batches WHERE batch_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/alerts/near-expiry/999/dismiss')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 409 INVALID_STATE_TRANSITION if batch is already expired', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM batches') && sql.includes('batch_id = $1')) {
          return {
            rows: [
              {
                batch_id: 102,
                medicine_id: 6,
                batch_number: 'BATCH-OLD',
                expiry_date: '2026-01-01',
                is_expired: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/alerts/near-expiry/102/dismiss')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });

    it('returns 200 and records dismissal timestamp', async () => {
      const now = new Date();
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM batches') && sql.includes('batch_id = $1')) {
          return {
            rows: [
              {
                batch_id: 101,
                medicine_id: 5,
                batch_number: 'BATCH-2026-A',
                expiry_date: '2026-11-15',
                is_expired: false,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('UPDATE batches')) {
          return {
            rows: [
              {
                batch_id: 101,
                medicine_id: 5,
                batch_number: 'BATCH-2026-A',
                expiry_date: '2026-11-15',
                expiry_alert_dismissed_at: now,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/alerts/near-expiry/101/dismiss')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.NEAR_EXPIRY_DISMISSED);
      expect(res.body.data.batchId).toBe(101);
      expect(res.body.data.expiryAlertDismissedAt).toBeDefined();
    });
  });

  describe('POST /api/v1/batches/:batchId/remove-expired', () => {
    it('returns 409 INVALID_STATE_TRANSITION on an unexpired batch', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('FROM batches') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ batch_id: 101, expiry_date: '2099-12-31', quantity_on_hand: 50 }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      };

      vi.spyOn(db.pool, 'connect').mockResolvedValue(mockClient as any);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/batches/101/remove-expired')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Disposal test' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });

    it('successfully writes off expired batch, zeros quantity, and returns 200', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('SELECT') && sql.includes('FROM batches') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{ batch_id: 102, expiry_date: '2020-01-01', quantity_on_hand: 75 }],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE batches SET quantity_on_hand')) {
            return { rows: [{ batch_id: 102, quantity_on_hand: 0 }], rowCount: 1 };
          }
          if (sql.includes('INSERT INTO stock_ledger_entries')) {
            return { rows: [{ entry_id: 999, balance_after: 0 }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      };

      vi.spyOn(db.pool, 'connect').mockResolvedValue(mockClient as any);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/batches/102/remove-expired')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Disposed in bio-waste container' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.EXPIRED_BATCH_REMOVED);
      expect(res.body.data.removedQuantity).toBe(75);
      expect(res.body.data.balanceAfter).toBe(0);
    });
  });
});
