import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Medicine Master Integration Endpoints (/api/v1/medicines)', () => {
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

  describe('GET /api/v1/medicines', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/medicines');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when called by retailer or delivery', async () => {
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
        .get('/api/v1/medicines')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with paginated list of medicines for admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('COUNT(*)::int AS total FROM medicines')) {
          return { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM medicines')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK',
                pack_size: '10 Tablets',
                gst_rate: '12.00',
                salt_ids: [1, 2],
                salts_text: 'Amoxicillin + Potassium Clavulanate',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [
              { salt_id: 1, salt_name: 'Amoxicillin' },
              { salt_id: 2, salt_name: 'Potassium Clavulanate' },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/medicines?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.MEDICINES_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Augmentin 625 Duo');
      expect(res.body.data[0].gstRate).toBe('12.00');
      expect(res.body.data[0].salts).toHaveLength(2);
      expect(res.body.data[0].salts[0].saltName).toBe('Amoxicillin');
    });
  });

  describe('POST /api/v1/medicines', () => {
    it('fails with 400 VALIDATION_ERROR when salt ID does not exist or is inactive', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [
              { salt_id: 1, salt_name: 'Amoxicillin', is_active: true },
              { salt_id: 99, salt_name: 'Old Salt', is_active: false }, // inactive
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Med',
          company: 'Pharma Co',
          packSize: '10 Strip',
          gstRate: 12,
          saltIds: [1, 99],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.errors[0].field).toBe('saltIds.1');
    });

    it('rejects duplicate medicine identity with 409 DUPLICATE_RESOURCE', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Amoxicillin', is_active: true }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SELECT medicine_id FROM medicines')) {
          return {
            rows: [{ medicine_id: 10 }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '  augmentin 625 duo  ',
          company: 'gsk',
          packSize: '10 tablets',
          gstRate: 12,
          saltIds: [1],
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE);
    });

    it('creates medicine successfully with mapped salts', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Amoxicillin', is_active: true }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SELECT medicine_id FROM medicines')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('INSERT INTO medicines')) {
          return {
            rows: [
              {
                medicine_id: 25,
                name: 'Mox 500',
                company: 'Ranbaxy',
                pack_size: '10 Capsules',
                gst_rate: 12,
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mox 500',
          company: 'Ranbaxy',
          packSize: '10 Capsules',
          gstRate: 12,
          saltIds: [1],
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(SUCCESS_CODES.MEDICINE_CREATED);
      expect(res.body.data.medicineId).toBe(25);
      expect(res.body.data.salts[0].saltName).toBe('Amoxicillin');
    });
  });

  describe('GET /api/v1/medicines/search', () => {
    it('allows access to delivery role and returns trigram matches', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: deliveryId, username: 'delivery', role: 'DELIVERY', phone: '9888888888', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('GREATEST(')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK',
                pack_size: '10 Tablets',
                gst_rate: '12.00',
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
                score: 0.82,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Amoxicillin' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/medicines/search?q=augment')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.MEDICINES_SEARCHED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].score).toBe(0.82);
    });
  });

  describe('GET /api/v1/medicines/:medicineId', () => {
    it('returns 200 with onHand and activeBatchCount aggregates', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM medicines') && sql.includes('WHERE medicine_id = $1')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK',
                pack_size: '10 Tablets',
                gst_rate: '12.00',
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SUM(quantity_on_hand)')) {
          return {
            rows: [{ on_hand: 140, active_batch_count: 3 }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Amoxicillin' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/medicines/10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.MEDICINE_FETCHED);
      expect(res.body.data.onHand).toBe(140);
      expect(res.body.data.activeBatchCount).toBe(3);
    });
  });

  describe('PATCH /api/v1/medicines/:medicineId', () => {
    it('rejects GST rate modification when existing batch selling price exceeds MRP with 422', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM medicines WHERE medicine_id = $1')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK',
                pack_size: '10 Tablets',
                gst_rate: '5.00',
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('ROUND(selling_price * (1.0 + ($2 / 100.0)), 2) > mrp')) {
          return {
            rows: [{ batch_id: 101, batch_number: 'B-9988', mrp: '100.00', selling_price: '90.00' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .patch('/api/v1/medicines/10')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ gstRate: 18 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ERROR_CODES.PRICE_EXCEEDS_MRP);
      expect(res.body.errors[0].field).toBe('gstRate');
    });

    it('updates medicine successfully when valid', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM medicines WHERE medicine_id = $1')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK',
                pack_size: '10 Tablets',
                gst_rate: '12.00',
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('UPDATE medicines')) {
          return {
            rows: [
              {
                medicine_id: 10,
                name: 'Augmentin 625 Duo',
                company: 'GSK India',
                pack_size: '10 Tablets',
                gst_rate: '12.00',
                salt_ids: [1],
                salts_text: 'Amoxicillin',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = ANY($1)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Amoxicillin' }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .patch('/api/v1/medicines/10')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ company: 'GSK India' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.MEDICINE_UPDATED);
      expect(res.body.data.company).toBe('GSK India');
    });
  });
});
