import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Batch Management Integration Endpoints (/api/v1/batches & /api/v1/stock/ledger)', () => {
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
    phone: '9876543210',
    mustChangePassword: false,
  });

  const mockAdminUser = {
    id: adminId,
    username: 'admin',
    role: 'ADMIN',
    phone: '9999999999',
    is_active: true,
    must_change_password: false,
  };

  const mockRetailerUser = {
    id: retailerId,
    username: 'retailer',
    role: 'RETAILER',
    phone: '9876543210',
    is_active: true,
    must_change_password: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/batches', () => {
    it('returns 403 FORBIDDEN when called by non-admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockRetailerUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/batches')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with list of batches and pagination metadata', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM batches b')) {
          return {
            rows: [
              {
                batch_id: 10,
                medicine_id: 1,
                batch_number: 'B-1001',
                expiry_date: '2027-10-15',
                mrp: '100.00',
                selling_price: '80.00',
                purchase_rate: '60.00',
                quantity_on_hand: 50,
                status: 'ACTIVE',
                gtin: '08901234567890',
                expiry_alert_dismissed_at: null,
                created_by: adminId,
                created_at: '2026-10-18T10:00:00Z',
                updated_at: '2026-10-18T10:00:00Z',
                medicine_name: 'Paracetamol 500mg',
                medicine_company: 'Acme Pharma',
                medicine_pack_size: '10 tablets',
                gst_rate: '12.00',
                days_left: 362,
                price_incl_gst: '89.60',
                full_count: 1,
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
        .get('/api/v1/batches?expiry=NEAR&inStock=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.BATCHES_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].batchNumber).toBe('B-1001');
      expect(res.body.data[0].daysLeft).toBe(362);
      expect(res.body.data[0].priceInclGst).toBe('89.60');
      expect(res.body.meta.pagination.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/batches/:batchId', () => {
    it('returns 404 NOT_FOUND when batch does not exist', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/batches/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 200 with batch detail and its recent ledger entries', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM batches b') && sql.includes('WHERE b.batch_id = $1')) {
          return {
            rows: [
              {
                batch_id: 10,
                medicine_id: 1,
                batch_number: 'B-1001',
                expiry_date: '2027-10-15',
                mrp: '100.00',
                selling_price: '80.00',
                purchase_rate: '60.00',
                quantity_on_hand: 50,
                status: 'ACTIVE',
                gtin: '08901234567890',
                expiry_alert_dismissed_at: null,
                created_by: adminId,
                created_at: '2026-10-18T10:00:00Z',
                updated_at: '2026-10-18T10:00:00Z',
                medicine_name: 'Paracetamol 500mg',
                medicine_company: 'Acme Pharma',
                medicine_pack_size: '10 tablets',
                gst_rate: '12.00',
                days_left: 362,
                price_incl_gst: '89.60',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('FROM stock_ledger_entries sle')) {
          return {
            rows: [
              {
                entry_id: 1,
                batch_id: 10,
                type: 'INWARD',
                delta: 50,
                balance_after: 50,
                reason: 'Initial stock inward',
                supplier_name: 'Apex Wholesale',
                order_id: null,
                order_item_id: null,
                created_at: '2026-10-18T10:00:00Z',
                created_by: adminId,
                created_by_name: 'Admin User',
                created_by_username: 'admin',
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
        .get('/api/v1/batches/10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.BATCH_FETCHED);
      expect(res.body.data.batch.batchNumber).toBe('B-1001');
      expect(res.body.data.ledgerEntries).toHaveLength(1);
      expect(res.body.data.ledgerEntries[0].type).toBe('INWARD');
    });
  });

  describe('PATCH /api/v1/batches/:batchId', () => {
    it('returns 422 PRICE_EXCEEDS_MRP when new selling price incl. GST exceeds MRP', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            const s = sql.replace(/\s+/g, ' ');
            if (s.includes('FROM batches b JOIN medicines m')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    mrp: '100.00',
                    gst_rate: '12.00',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        } as unknown as any;
        return callback(mockClient);
      });

      // selling price 95 with 12% GST = 106.40 > 100.00 MRP
      const res = await request(app)
        .patch('/api/v1/batches/10')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sellingPrice: '95.00',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PRICE_EXCEEDS_MRP');
    });

    it('returns 200 when updating selling price and status within MRP', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            const s = sql.replace(/\s+/g, ' ');
            if (s.includes('FOR UPDATE')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    mrp: '100.00',
                    gst_rate: '12.00',
                  },
                ],
                rowCount: 1,
              };
            }
            if (s.includes('UPDATE batches SET')) {
              return { rowCount: 1 };
            }
            if (s.includes('SELECT b.batch_id')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    medicine_id: 1,
                    batch_number: 'B-1001',
                    expiry_date: '2027-10-15',
                    mrp: '100.00',
                    selling_price: '85.00',
                    purchase_rate: '60.00',
                    quantity_on_hand: 50,
                    status: 'BLOCKED',
                    gtin: null,
                    expiry_alert_dismissed_at: null,
                    created_by: adminId,
                    created_at: '2026-10-18T10:00:00Z',
                    updated_at: '2026-10-18T11:00:00Z',
                    medicine_name: 'Paracetamol 500mg',
                    medicine_company: 'Acme Pharma',
                    medicine_pack_size: '10 tablets',
                    gst_rate: '12.00',
                    days_left: 362,
                    price_incl_gst: '95.20',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        } as unknown as any;
        return callback(mockClient);
      });

      const res = await request(app)
        .patch('/api/v1/batches/10')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sellingPrice: '85.00',
          status: 'BLOCKED',
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.BATCH_UPDATED);
      expect(res.body.data.sellingPrice).toBe('85.00');
      expect(res.body.data.status).toBe('BLOCKED');
    });
  });

  describe('POST /api/v1/batches/:batchId/adjust', () => {
    it('returns 400 validation error when reason is shorter than 5 characters', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/batches/10/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'DAMAGE',
          quantity: 2,
          reason: 'dmg', // < 5 chars
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 409 INVALID_STATE_TRANSITION when attempting EXPIRY_WRITEOFF on unexpired batch', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            const s = sql.replace(/\s+/g, ' ');
            if (s.includes('FROM batches WHERE batch_id = $1 FOR UPDATE')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    expiry_date: '2028-01-01', // future date
                    quantity_on_hand: 50,
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        } as unknown as any;
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/batches/10/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'EXPIRY_WRITEOFF',
          quantity: 10,
          reason: 'Expired stock disposal',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('returns 200 when adjusting stock for DAMAGE with negative delta', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            const s = sql.replace(/\s+/g, ' ');
            // 1. Initial lock check in adjustBatch
            if (s.includes('FROM batches WHERE batch_id = $1 FOR UPDATE')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    expiry_date: '2027-10-15',
                    quantity_on_hand: 50,
                  },
                ],
                rowCount: 1,
              };
            }
            // 2. Lock check inside applyLedgerEntry
            if (s.includes('SELECT quantity_on_hand FROM batches WHERE batch_id = $1 FOR UPDATE')) {
              return {
                rows: [{ quantity_on_hand: 50 }],
                rowCount: 1,
              };
            }
            // 3. Batch quantity update
            if (s.includes('UPDATE batches SET quantity_on_hand = quantity_on_hand + $1')) {
              return {
                rows: [{ quantity_on_hand: 45 }],
                rowCount: 1,
              };
            }
            // 4. Ledger insert
            if (s.includes('INSERT INTO stock_ledger_entries')) {
              return {
                rows: [{ entry_id: 101 }],
                rowCount: 1,
              };
            }
            // 5. Updated batch select
            if (s.includes('SELECT b.batch_id')) {
              return {
                rows: [
                  {
                    batch_id: 10,
                    medicine_id: 1,
                    batch_number: 'B-1001',
                    expiry_date: '2027-10-15',
                    mrp: '100.00',
                    selling_price: '80.00',
                    purchase_rate: '60.00',
                    quantity_on_hand: 45,
                    status: 'ACTIVE',
                    gtin: null,
                    expiry_alert_dismissed_at: null,
                    created_by: adminId,
                    created_at: '2026-10-18T10:00:00Z',
                    updated_at: '2026-10-18T12:00:00Z',
                    medicine_name: 'Paracetamol 500mg',
                    medicine_company: 'Acme Pharma',
                    medicine_pack_size: '10 tablets',
                    gst_rate: '12.00',
                    days_left: 362,
                    price_incl_gst: '89.60',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        } as unknown as any;
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/batches/10/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'DAMAGE',
          quantity: 5,
          reason: 'Water damage during storage',
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.BATCH_ADJUSTED);
      expect(res.body.data.batch.quantityOnHand).toBe(45);
      expect(res.body.data.ledgerEntry.delta).toBe(-5);
      expect(res.body.data.ledgerEntry.balanceAfter).toBe(45);
    });

    it('returns 200 when applying EXPIRY_WRITEOFF on an expired batch', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            const s = sql.replace(/\s+/g, ' ');
            if (s.includes('FROM batches WHERE batch_id = $1 FOR UPDATE')) {
              return {
                rows: [
                  {
                    batch_id: 11,
                    expiry_date: '2025-01-01', // Past date
                    quantity_on_hand: 20,
                  },
                ],
                rowCount: 1,
              };
            }
            if (s.includes('SELECT quantity_on_hand FROM batches WHERE batch_id = $1 FOR UPDATE')) {
              return {
                rows: [{ quantity_on_hand: 20 }],
                rowCount: 1,
              };
            }
            if (s.includes('UPDATE batches SET quantity_on_hand = quantity_on_hand + $1')) {
              return {
                rows: [{ quantity_on_hand: 0 }],
                rowCount: 1,
              };
            }
            if (s.includes('INSERT INTO stock_ledger_entries')) {
              return {
                rows: [{ entry_id: 102 }],
                rowCount: 1,
              };
            }
            if (s.includes('SELECT b.batch_id')) {
              return {
                rows: [
                  {
                    batch_id: 11,
                    medicine_id: 1,
                    batch_number: 'B-OLD',
                    expiry_date: '2025-01-01',
                    mrp: '100.00',
                    selling_price: '80.00',
                    purchase_rate: '60.00',
                    quantity_on_hand: 0,
                    status: 'ACTIVE',
                    gtin: null,
                    expiry_alert_dismissed_at: null,
                    created_by: adminId,
                    created_at: '2025-01-01T10:00:00Z',
                    updated_at: '2026-10-18T12:00:00Z',
                    medicine_name: 'Paracetamol 500mg',
                    medicine_company: 'Acme Pharma',
                    medicine_pack_size: '10 tablets',
                    gst_rate: '12.00',
                    days_left: -656,
                    price_incl_gst: '89.60',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        } as unknown as any;
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/batches/11/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'EXPIRY_WRITEOFF',
          quantity: 20,
          reason: 'Batch expired disposal',
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.BATCH_ADJUSTED);
      expect(res.body.data.batch.quantityOnHand).toBe(0);
      expect(res.body.data.ledgerEntry.delta).toBe(-20);
      expect(res.body.data.ledgerEntry.balanceAfter).toBe(0);
    });
  });

  describe('GET /api/v1/stock/ledger', () => {
    it('returns 200 with list of audit log movements and filters', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [mockAdminUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM stock_ledger_entries sle')) {
          return {
            rows: [
              {
                entry_id: 1,
                batch_id: 10,
                type: 'INWARD',
                delta: 100,
                balance_after: 100,
                reason: 'Stock inward',
                supplier_name: 'Metro Pharma',
                order_id: null,
                order_item_id: null,
                created_at: '2026-10-18T10:00:00Z',
                created_by: adminId,
                batch_number: 'B-1001',
                expiry_date: '2027-10-15',
                mrp: '100.00',
                selling_price: '80.00',
                medicine_id: 1,
                medicine_name: 'Paracetamol 500mg',
                medicine_company: 'Acme Pharma',
                created_by_name: 'Admin User',
                created_by_username: 'admin',
                full_count: 1,
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
        .get('/api/v1/stock/ledger?type=INWARD&page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.LEDGER_ENTRIES_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('INWARD');
      expect(res.body.data[0].supplierName).toBe('Metro Pharma');
      expect(res.body.meta.pagination.totalItems).toBe(1);
    });
  });
});
