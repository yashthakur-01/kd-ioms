import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Catalog Integration Endpoints (/api/v1/catalog)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const deliveryId = '33333333-3333-4333-a333-333333333333';
  const approvedRetailerId = '22222222-2222-4222-a222-222222222222';
  const pendingRetailerId = '44444444-4444-4444-a444-444444444444';
  const rejectedRetailerId = '55555555-5555-4555-a555-555555555555';

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

  const approvedRetailerToken = tokensUtils.signAccessToken({
    sub: approvedRetailerId,
    username: 'approved_retailer',
    role: 'RETAILER',
    phone: '9777777777',
    mustChangePassword: false,
  });

  const pendingRetailerToken = tokensUtils.signAccessToken({
    sub: pendingRetailerId,
    username: 'pending_retailer',
    role: 'RETAILER',
    phone: '9666666666',
    mustChangePassword: false,
  });

  const rejectedRetailerToken = tokensUtils.signAccessToken({
    sub: rejectedRetailerId,
    username: 'rejected_retailer',
    role: 'RETAILER',
    phone: '9555555555',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Access Control & Retailer KYC Gating', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/catalog');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 RETAILER_NOT_APPROVED when called by retailer with PENDING approval', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: pendingRetailerId, username: 'pending_retailer', role: 'RETAILER', phone: '9666666666', is_active: true, must_change_password: false }],
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
        .get('/api/v1/catalog')
        .set('Authorization', `Bearer ${pendingRetailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
    });

    it('returns 403 RETAILER_NOT_APPROVED when called by retailer with REJECTED approval', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: rejectedRetailerId, username: 'rejected_retailer', role: 'RETAILER', phone: '9555555555', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'REJECTED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog')
        .set('Authorization', `Bearer ${rejectedRetailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
    });

    it('returns 200 OK when called by APPROVED retailer', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return {
            rows: [{ approval_status: 'APPROVED' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('COUNT(*)::INT AS total FROM v_catalog')) {
          return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_catalog')) {
          return {
            rows: [
              {
                medicine_id: 1,
                name: 'Paracetamol 500mg',
                company: 'Cipla',
                pack_size: '10 Tablets',
                salts_text: 'Paracetamol (500mg)',
                salt_ids: [10],
                gst_rate: 12.0,
                max_mrp: 30.0,
                max_price_incl_gst: 24.64,
                available_qty: 150,
                in_stock: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 10, salt_name: 'Paracetamol' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog')
        .set('Authorization', `Bearer ${approvedRetailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.CATALOG_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Paracetamol 500mg');
      expect(res.body.data[0].salts).toEqual([{ saltId: 10, saltName: 'Paracetamol' }]);
    });

    it('returns 200 OK when called by ADMIN or DELIVERY', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryId, username: 'delivery', role: 'DELIVERY', phone: '9888888888', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('COUNT(*)::INT AS total FROM v_catalog')) {
          return { rows: [{ total: 0 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_catalog')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.CATALOG_LISTED);
    });
  });

  describe('Search, Filters & Sorting', () => {
    it('applies search, saltId, and inStock filters to database query', async () => {
      let executedSql = '';
      let executedParams: unknown[] = [];

      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM v_catalog')) {
          executedSql = sql;
          executedParams = params;
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('COUNT(*)::INT AS total FROM v_catalog')) {
          return { rows: [{ total: 0 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog?q=Augmentin&saltId=5&inStock=true&sort=price')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(executedSql).toContain('name ILIKE $1 OR company ILIKE $1 OR salts_text ILIKE $1');
      expect(executedSql).toContain('$2 = ANY(salt_ids)');
      expect(executedSql).toContain('available_qty > 0');
      expect(executedSql).toContain('ORDER BY max_price_incl_gst ASC NULLS LAST, name ASC');
      expect(executedParams[0]).toBe('%Augmentin%');
      expect(executedParams[1]).toBe(5);
    });
  });

  describe('Information Masking (Security Invariant)', () => {
    it('strictly hides batch numbers, purchase rates, supplier details, and expiry dates', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'APPROVED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('COUNT(*)::INT AS total FROM v_catalog')) {
          return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_catalog')) {
          return {
            rows: [
              {
                medicine_id: 101,
                name: 'Azithromycin 500',
                company: 'Zydus',
                pack_size: '3 Tablets',
                salts_text: 'Azithromycin (500mg)',
                salt_ids: [22],
                gst_rate: 12.0,
                max_mrp: 120.0,
                max_price_incl_gst: 105.0,
                available_qty: 40,
                in_stock: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return { rows: [{ salt_id: 22, salt_name: 'Azithromycin' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog')
        .set('Authorization', `Bearer ${approvedRetailerToken}`);

      expect(res.status).toBe(200);
      const item = res.body.data[0];

      // Verifying allowed fields
      expect(item).toHaveProperty('medicineId');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('company');
      expect(item).toHaveProperty('packSize');
      expect(item).toHaveProperty('saltsText');
      expect(item).toHaveProperty('salts');
      expect(item).toHaveProperty('maxMrp');
      expect(item).toHaveProperty('maxPriceInclGst');
      expect(item).toHaveProperty('availableQty');
      expect(item).toHaveProperty('inStock');

      // Verifying strict absence of internal batch & cost attributes
      expect(item).not.toHaveProperty('batchNumber');
      expect(item).not.toHaveProperty('batch_number');
      expect(item).not.toHaveProperty('batchId');
      expect(item).not.toHaveProperty('batch_id');
      expect(item).not.toHaveProperty('purchaseRate');
      expect(item).not.toHaveProperty('purchase_rate');
      expect(item).not.toHaveProperty('cost');
      expect(item).not.toHaveProperty('expiryDate');
      expect(item).not.toHaveProperty('expiry_date');
      expect(item).not.toHaveProperty('supplier');
    });
  });

  describe('GET /api/v1/catalog/:medicineId', () => {
    it('returns 200 with single catalog item when found', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'APPROVED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_catalog') && sql.includes('medicine_id = $1')) {
          return {
            rows: [
              {
                medicine_id: 101,
                name: 'Azithromycin 500',
                company: 'Zydus',
                pack_size: '3 Tablets',
                salts_text: 'Azithromycin (500mg)',
                salt_ids: [22],
                gst_rate: 12.0,
                max_mrp: 120.0,
                max_price_incl_gst: 105.0,
                available_qty: 40,
                in_stock: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return { rows: [{ salt_id: 22, salt_name: 'Azithromycin' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog/101')
        .set('Authorization', `Bearer ${approvedRetailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.CATALOG_ITEM_FETCHED);
      expect(res.body.data.medicineId).toBe(101);
      expect(res.body.data.name).toBe('Azithromycin 500');
    });

    it('returns 404 NOT_FOUND when medicineId does not exist', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'APPROVED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM v_catalog') && sql.includes('medicine_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/catalog/999999')
        .set('Authorization', `Bearer ${approvedRetailerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });
});
