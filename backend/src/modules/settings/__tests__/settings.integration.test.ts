import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';
import { invalidateSettingsCache } from '../settings.service.js';

describe('Settings Module Integration Endpoints (/api/v1/settings)', () => {
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
    invalidateSettingsCache();
  });

  describe('GET /api/v1/settings', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/settings');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when requested by non-admin role', async () => {
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
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with system settings for admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM app_settings')) {
          return {
            rows: [
              { key: 'expiry_alert_days', value: { days: 60 } },
              {
                key: 'business_profile',
                value: {
                  name: 'Kandarp Drugs',
                  address: 'Ahmedabad, Gujarat',
                  gstin: '24AAAAA0000A1Z5',
                  drugLicenseNumber: 'GJ-AHM-123456',
                  phone: '+919876543210',
                  email: 'info@kandarpdrugs.com',
                  logoPath: null,
                },
              },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.SETTINGS_FETCHED);
      expect(res.body.data.expiryAlertDays).toBe(60);
      expect(res.body.data.businessProfile.gstin).toBe('24AAAAA0000A1Z5');
      expect(res.body.data.businessProfile.name).toBe('Kandarp Drugs');
    });

    it('uses in-memory 60s TTL cache on subsequent requests', async () => {
      let dbQueryCount = 0;
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM app_settings')) {
          dbQueryCount++;
          return {
            rows: [
              { key: 'expiry_alert_days', value: { days: 60 } },
              {
                key: 'business_profile',
                value: {
                  name: 'Kandarp Drugs',
                  address: 'Ahmedabad, Gujarat',
                  gstin: '24AAAAA0000A1Z5',
                  drugLicenseNumber: 'GJ-AHM-123456',
                  phone: '+919876543210',
                  email: 'info@kandarpdrugs.com',
                },
              },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      // Request 1: cache miss
      const res1 = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);
      expect(dbQueryCount).toBe(1);

      // Request 2: cache hit (dbQueryCount should NOT increment)
      const res2 = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(dbQueryCount).toBe(1);
    });
  });

  describe('PATCH /api/v1/settings', () => {
    it('returns 400 when body is empty', async () => {
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
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 400 when expiryAlertDays is invalid (< 1 or > 730)', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const resBelow = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ expiryAlertDays: 0 });
      expect(resBelow.status).toBe(400);
      expect(resBelow.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      const resAbove = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ expiryAlertDays: 731 });
      expect(resAbove.status).toBe(400);
      expect(resAbove.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 400 when GSTIN format is invalid', async () => {
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
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessProfile: {
            gstin: 'INVALID_GSTIN_123',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('successfully updates settings, evicts cache, and returns 200 with new settings', async () => {
      let currentExpiryDays = 60;
      let currentProfile = {
        name: 'Kandarp Drugs',
        address: 'Ahmedabad, Gujarat',
        gstin: '24AAAAA0000A1Z5',
        drugLicenseNumber: 'GJ-AHM-123456',
        phone: '+919876543210',
        email: 'info@kandarpdrugs.com',
        logoPath: null,
      };

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('UPDATE app_settings') && sql.includes('expiry_alert_days')) {
            currentExpiryDays = params![0];
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('SELECT value FROM app_settings WHERE key = \'business_profile\' FOR UPDATE')) {
            return { rows: [{ value: currentProfile }], rowCount: 1 };
          }
          if (sql.includes('UPDATE app_settings') && sql.includes('business_profile')) {
            currentProfile = JSON.parse(params![0]);
            return { rows: [], rowCount: 1 };
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
        if (sql.includes('FROM app_settings')) {
          return {
            rows: [
              { key: 'expiry_alert_days', value: { days: currentExpiryDays } },
              { key: 'business_profile', value: currentProfile },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expiryAlertDays: 90,
          businessProfile: {
            phone: '+919999888877',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.SETTINGS_UPDATED);
      expect(res.body.data.expiryAlertDays).toBe(90);
      expect(res.body.data.businessProfile.phone).toBe('+919999888877');
      // Preserves existing name and gstin
      expect(res.body.data.businessProfile.name).toBe('Kandarp Drugs');
      expect(res.body.data.businessProfile.gstin).toBe('24AAAAA0000A1Z5');
    });
  });
});
