import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';

describe('Stock Inward Integration Endpoints (/api/v1/stock)', () => {
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/stock/inward', () => {
    it('returns 403 FORBIDDEN when called by non-admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: retailerId,
                username: 'retailer',
                role: 'RETAILER',
                phone: '9876543210',
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

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-2026-X',
          expiryDate: '2027-12-31',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 20,
          captureMethod: 'MANUAL',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 404 NOT_FOUND when medicine does not exist or is inactive', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM medicines') && !sql.includes('JOIN')) {
            return { rows: [] }; // Medicine not found
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 999,
          batchNumber: 'BATCH-2026-X',
          expiryDate: '2027-12-31',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 20,
          captureMethod: 'MANUAL',
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 422 EXPIRY_IN_PAST when expiry date is before today', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM medicines') && !sql.includes('JOIN')) {
            return {
              rows: [
                {
                  medicine_id: 1,
                  name: 'Paracetamol 500mg',
                  company: 'Cipla',
                  pack_size: '10 tablets',
                  gst_rate: '12.00',
                  is_active: true,
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-PAST',
          expiryDate: '2020-01-01',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 20,
          captureMethod: 'MANUAL',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.EXPIRY_IN_PAST);
    });

    it('returns 422 PRICE_EXCEEDS_MRP when selling price inclusive of GST exceeds MRP', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM medicines') && !sql.includes('JOIN')) {
            return {
              rows: [
                {
                  medicine_id: 1,
                  name: 'Paracetamol 500mg',
                  company: 'Cipla',
                  pack_size: '10 tablets',
                  gst_rate: '12.00', // 12% GST
                  is_active: true,
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      // 95.00 * 1.12 = 106.40 > 100.00 MRP
      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-OVERPRICED',
          expiryDate: '2028-06-30',
          mrp: '100.00',
          sellingPrice: '95.00',
          quantity: 10,
          captureMethod: 'MANUAL',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.PRICE_EXCEEDS_MRP);
    });

    it('returns 422 BATCH_MEDICINE_MISMATCH when GTIN belongs to another medicine', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM medicines') && !sql.includes('JOIN')) {
            return {
              rows: [
                {
                  medicine_id: 1,
                  name: 'Paracetamol 500mg',
                  company: 'Cipla',
                  pack_size: '10 tablets',
                  gst_rate: '12.00',
                  is_active: true,
                },
              ],
            };
          }
          if (sql.includes('FROM batches WHERE gtin = $1 AND medicine_id != $2')) {
            return { rows: [{ medicine_id: 2 }] }; // GTIN belongs to medicine 2
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-GTIN-CONFLICT',
          expiryDate: '2028-06-30',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 10,
          gtin: '08901234567890',
          captureMethod: 'SCAN_BARCODE',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.BATCH_MEDICINE_MISMATCH);
    });

    it('creates new batch when batch identity does not exist (batchCreated: true)', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          // normalize whitespace
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM medicines') && !s.includes('JOIN')) {
            return {
              rows: [
                {
                  medicine_id: 1,
                  name: 'Paracetamol 500mg',
                  company: 'Cipla',
                  pack_size: '10 tablets',
                  gst_rate: '12.00',
                  is_active: true,
                },
              ],
            };
          }
          if (s.includes('FROM batches WHERE gtin = $1')) {
            return { rows: [] };
          }
          if (s.includes('FROM batches WHERE medicine_id = $1')) {
            return { rows: [] }; // new batch
          }
          if (s.includes('INSERT INTO batches')) {
            return { rows: [{ batch_id: 42 }] };
          }
          if (s.includes('SELECT batch_id, quantity_on_hand')) {
            return { rows: [{ batch_id: 42, quantity_on_hand: 0, status: 'ACTIVE', expiry_date: '2028-06-30' }] };
          }
          if (s.includes('UPDATE batches SET quantity_on_hand')) {
            return { rows: [] };
          }
          if (s.includes('INSERT INTO stock_ledger_entries')) {
            return { rows: [{ entry_id: 991 }] };
          }
          if (s.includes('FROM batches WHERE batch_id = $1')) {
            return {
              rows: [
                {
                  batch_id: 42,
                  medicine_id: 1,
                  batch_number: 'BATCH-2026-NEW',
                  expiry_date: '2028-06-30',
                  mrp: '100.00',
                  selling_price: '80.00',
                  purchase_rate: '60.00',
                  quantity_on_hand: 50,
                  status: 'ACTIVE',
                  gtin: '08901234567890',
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-2026-NEW',
          expiryDate: '2028-06-30',
          mrp: '100.00',
          sellingPrice: '80.00',
          purchaseRate: '60.00',
          quantity: 50,
          gtin: '08901234567890',
          supplierName: 'Cipla Direct',
          captureMethod: 'SCAN_BARCODE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batchCreated).toBe(true);
      expect(res.body.data.batch.batchId).toBe(42);
      expect(res.body.data.batch.quantityOnHand).toBe(50);
      expect(res.body.data.ledgerEntry.balanceAfter).toBe(50);
      expect(res.body.data.ledgerEntry.entryId).toBe(991);
    });

    it('tops up existing batch when identity matches (batchCreated: false)', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM medicines') && !s.includes('JOIN')) {
            return {
              rows: [
                {
                  medicine_id: 1,
                  name: 'Paracetamol 500mg',
                  company: 'Cipla',
                  pack_size: '10 tablets',
                  gst_rate: '12.00',
                  is_active: true,
                },
              ],
            };
          }
          if (s.includes('FROM batches WHERE medicine_id = $1 AND batch_number = $2')) {
            return {
              rows: [
                {
                  batch_id: 42,
                  medicine_id: 1,
                  batch_number: 'BATCH-2026-EXISTING',
                  expiry_date: '2028-06-30',
                  mrp: '100.00',
                  selling_price: '80.00',
                  purchase_rate: '60.00',
                  quantity_on_hand: 50,
                  status: 'ACTIVE',
                  gtin: null,
                },
              ],
            };
          }
          if (s.includes('SELECT batch_id, quantity_on_hand')) {
            return { rows: [{ batch_id: 42, quantity_on_hand: 50, status: 'ACTIVE', expiry_date: '2028-06-30' }] };
          }
          if (s.includes('UPDATE batches SET quantity_on_hand')) {
            return { rows: [] };
          }
          if (s.includes('INSERT INTO stock_ledger_entries')) {
            return { rows: [{ entry_id: 992 }] };
          }
          if (s.includes('FROM batches WHERE batch_id = $1')) {
            return {
              rows: [
                {
                  batch_id: 42,
                  medicine_id: 1,
                  batch_number: 'BATCH-2026-EXISTING',
                  expiry_date: '2028-06-30',
                  mrp: '100.00',
                  selling_price: '80.00',
                  purchase_rate: '60.00',
                  quantity_on_hand: 80, // 50 + 30
                  status: 'ACTIVE',
                  gtin: null,
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as any;

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => fn(mockClient));

      const res = await request(app)
        .post('/api/v1/stock/inward')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicineId: 1,
          batchNumber: 'BATCH-2026-EXISTING',
          expiryDate: '2028-06-30',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 30,
          captureMethod: 'MANUAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batchCreated).toBe(false);
      expect(res.body.data.batch.quantityOnHand).toBe(80);
      expect(res.body.data.ledgerEntry.balanceAfter).toBe(80);
      expect(res.body.data.ledgerEntry.entryId).toBe(992);
    });
  });

  describe('POST /api/v1/stock/scan/resolve', () => {
    it('returns 403 when called by non-admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: retailerId,
                username: 'retailer',
                role: 'RETAILER',
                phone: '9876543210',
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

      const res = await request(app)
        .post('/api/v1/stock/scan/resolve')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ payload: '(01)08901234567890(10)BATCH1(17)280630' });

      expect(res.status).toBe(403);
    });

    it('extracts GS1 identifiers and returns medicine suggestions', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: adminId,
                username: 'admin',
                role: 'ADMIN',
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
        if (sql.includes('batches b') && sql.includes('medicines m')) {
          return {
            rows: [
              {
                medicine_id: 1,
                name: 'Paracetamol 500mg',
                company: 'Cipla',
                pack_size: '10 tablets',
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
        .post('/api/v1/stock/scan/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payload: '(01)08901234567890(10)LOT-9988(17)280630' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gtin).toBe('08901234567890');
      expect(res.body.data.batchNumber).toBe('LOT-9988');
      expect(res.body.data.expiryDate).toBe('2028-06-30');
      expect(res.body.data.medicineSuggestions).toHaveLength(1);
      expect(res.body.data.medicineSuggestions[0].name).toBe('Paracetamol 500mg');
    });
  });
});
