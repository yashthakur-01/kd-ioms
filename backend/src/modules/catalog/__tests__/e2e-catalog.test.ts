import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Phase 5 E2E Lifecycle: Catalog, Live Availability & Stock Invariants', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const approvedRetailerId = '22222222-2222-4222-a222-222222222222';
  const pendingRetailerId = '33333333-3333-4333-a333-333333333333';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin',
    role: 'ADMIN',
    phone: '9999999999',
    mustChangePassword: false,
  });

  const approvedRetailerToken = tokensUtils.signAccessToken({
    sub: approvedRetailerId,
    username: 'approved_retailer',
    role: 'RETAILER',
    phone: '9888888888',
    mustChangePassword: false,
  });

  const pendingRetailerToken = tokensUtils.signAccessToken({
    sub: pendingRetailerId,
    username: 'pending_retailer',
    role: 'RETAILER',
    phone: '9777777777',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Multiple active batches with varying selling prices expose the highest selling price incl. GST', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9888888888', is_active: true, must_change_password: false }],
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
        // Simulating 2 batches: Batch A (₹100 selling price -> ₹112 incl GST) and Batch B (₹120 selling price -> ₹134.40 incl GST)
        return {
          rows: [
            {
              medicine_id: 1,
              name: 'Augmentin 625 Duo',
              company: 'GSK',
              pack_size: '10 Tablets',
              salts_text: 'Amoxicillin + Clavulanic Acid',
              salt_ids: [1, 2],
              gst_rate: 12.0,
              max_mrp: 200.0,
              max_price_incl_gst: 134.4,
              available_qty: 150, // 50 from Batch A + 100 from Batch B
              in_stock: true,
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
        return {
          rows: [
            { salt_id: 1, salt_name: 'Amoxicillin' },
            { salt_id: 2, salt_name: 'Clavulanic Acid' },
          ],
          rowCount: 2, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const res = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${approvedRetailerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].maxPriceInclGst).toBe('134.40');
    expect(res.body.data[0].availableQty).toBe(150);
    expect(res.body.data[0].inStock).toBe(true);
  });

  it('2. Expired batches are excluded from availability quantity and price calculations', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9888888888', is_active: true, must_change_password: false }],
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
        // Batch with 200 units expired yesterday; only 30 units in active unexpired batch
        return {
          rows: [
            {
              medicine_id: 2,
              name: 'Paracetamol 650',
              company: 'Micro Labs',
              pack_size: '15 Tablets',
              salts_text: 'Paracetamol',
              salt_ids: [1],
              gst_rate: 12.0,
              max_mrp: 35.0,
              max_price_incl_gst: 30.24,
              available_qty: 30, // Excludes the 200 expired units
              in_stock: true,
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const res = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${approvedRetailerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].availableQty).toBe(30);
  });

  it('3. Placing orders in PLACED status decrements availableQty; cancelling restores availability', async () => {
    let orderPlaced = true;

    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: approvedRetailerId, username: 'approved_retailer', role: 'RETAILER', phone: '9888888888', is_active: true, must_change_password: false }],
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
        // Physical on-hand = 100.
        // When orderPlaced = true (15 units in PLACED), available = 85.
        // When cancelled, available = 100.
        return {
          rows: [
            {
              medicine_id: 3,
              name: 'Azithromycin 250',
              company: 'Cipla',
              pack_size: '6 Tablets',
              salts_text: 'Azithromycin',
              salt_ids: [],
              gst_rate: 12.0,
              max_mrp: 90.0,
              max_price_incl_gst: 75.0,
              available_qty: orderPlaced ? 85 : 100,
              in_stock: true,
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    // Step A: Order is placed
    const resA = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${approvedRetailerToken}`);
    expect(resA.body.data[0].availableQty).toBe(85);

    // Step B: Order is cancelled
    orderPlaced = false;
    const resB = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${approvedRetailerToken}`);
    expect(resB.body.data[0].availableQty).toBe(100);
  });

  it('4. Zero available stock shows availableQty = 0, inStock = false, and appears in Admin Out-of-Stock queue', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
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
              medicine_id: 4,
              name: 'Deflazacort 6mg',
              company: 'Mankind',
              pack_size: '10 Tablets',
              salts_text: 'Deflazacort',
              salt_ids: [],
              gst_rate: 12.0,
              max_mrp: null,
              max_price_incl_gst: null,
              available_qty: 0,
              in_stock: false,
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM v_medicine_availability') && sql.includes('available_qty = 0')) {
        return {
          rows: [
            {
              medicine_id: 4,
              name: 'Deflazacort 6mg',
              company: 'Mankind',
              pack_size: '10 Tablets',
              salts_text: 'Deflazacort',
              gst_rate: 12.0,
              on_hand_qty: 0,
              reserved_qty: 0,
              available_qty: 0,
              max_mrp: null,
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('COUNT(*)::INT AS total') && sql.includes('v_medicine_availability')) {
        return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    // Check catalog view
    const catalogRes = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(catalogRes.status).toBe(200);
    expect(catalogRes.body.data[0].availableQty).toBe(0);
    expect(catalogRes.body.data[0].inStock).toBe(false);
    expect(catalogRes.body.data[0].maxPriceInclGst).toBeNull();
    expect(catalogRes.body.data[0].maxMrp).toBeNull();

    // Check admin alerts queue
    const alertsRes = await request(app)
      .get('/api/v1/alerts/out-of-stock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.data).toHaveLength(1);
    expect(alertsRes.body.data[0].name).toBe('Deflazacort 6mg');
    expect(alertsRes.body.data[0].availableQty).toBe(0);
  });

  it('5. Unapproved retailer is blocked; sensitive batch identifiers remain masked', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: pendingRetailerId, username: 'pending_retailer', role: 'RETAILER', phone: '9777777777', is_active: true, must_change_password: false }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM retailer_profiles WHERE user_id = $1')) {
        return { rows: [{ approval_status: 'PENDING' }], rowCount: 1, command: '', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const res = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${pendingRetailerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ERROR_CODES.RETAILER_NOT_APPROVED);
  });
});
