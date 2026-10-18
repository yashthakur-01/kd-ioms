import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Salt Master Integration Endpoints (/api/v1/salts)', () => {
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

  describe('GET /api/v1/salts', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/salts');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 when non-admin accesses', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: retailerId, username: 'retailer', role: 'RETAILER', phone: '9876543210', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/salts')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with list of salts and pagination for admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('COUNT(*)::int AS total')) {
          return { rows: [{ total: 2 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('FROM salts s')) {
          return {
            rows: [
              {
                salt_id: 1,
                salt_name: 'Amoxicillin',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                medicine_count: 5,
              },
              {
                salt_id: 2,
                salt_name: 'Paracetamol',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                medicine_count: 12,
              },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/salts?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.SALTS_LISTED);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].saltName).toBe('Amoxicillin');
      expect(res.body.data[0].medicineCount).toBe(5);
      expect(res.body.meta.pagination.totalItems).toBe(2);
    });
  });

  describe('GET /api/v1/salts/suggest', () => {
    it('returns 400 when query string is too short', async () => {
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
        .get('/api/v1/salts/suggest?q=a')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 200 with suggestions ranked by similarity', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('similarity(LOWER(salt_name)')) {
          return {
            rows: [
              { salt_id: 2, salt_name: 'Paracetamol', is_active: true, similarity: 0.85 },
              { salt_id: 3, salt_name: 'Paracetamol Sodium', is_active: true, similarity: 0.62 },
            ],
            rowCount: 2, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/salts/suggest?q=paracet')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.SALT_SUGGESTIONS);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].saltName).toBe('Paracetamol');
      expect(res.body.data[0].similarity).toBe(0.85);
    });
  });

  describe('POST /api/v1/salts', () => {
    it('rejects exact duplicate salt name with 409 DUPLICATE_RESOURCE', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('LOWER(TRIM(salt_name)) = LOWER($1)')) {
          return {
            rows: [{ salt_id: 1 }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/salts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ saltName: '  paracetamol  ' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE);
    });

    it('rejects near-matches with 409 SALT_SIMILAR_EXISTS unless confirmed', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('LOWER(TRIM(salt_name)) = LOWER($1)')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('similarity(LOWER(salt_name)')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Paracetamol', score: 0.75 }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/salts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ saltName: 'Paracetamol 500' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.SALT_SIMILAR_EXISTS);
      expect(res.body.errors[0].details.matches).toHaveLength(1);
      expect(res.body.errors[0].details.matches[0].saltName).toBe('Paracetamol');
    });

    it('creates salt when confirmSimilar: true is supplied for near-match', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('LOWER(TRIM(salt_name)) = LOWER($1)')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('INSERT INTO salts')) {
          return {
            rows: [
              {
                salt_id: 42,
                salt_name: 'Paracetamol 500',
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
        .post('/api/v1/salts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ saltName: 'Paracetamol 500', confirmSimilar: true });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(SUCCESS_CODES.SALT_CREATED);
      expect(res.body.data.saltId).toBe(42);
      expect(res.body.data.saltName).toBe('Paracetamol 500');
    });
  });

  describe('PATCH /api/v1/salts/:saltId', () => {
    it('returns 404 when salt does not exist', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .patch('/api/v1/salts/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ saltName: 'NonExistent' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('rejects deactivating a salt linked to active medicines with 409 SALT_IN_USE', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = $1')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Paracetamol', is_active: true }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SELECT COUNT(*)::int AS cnt FROM medicines')) {
          return { rows: [{ cnt: 3 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .patch('/api/v1/salts/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.SALT_IN_USE);
    });

    it('allows renaming salt successfully', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('FROM salts WHERE salt_id = $1')) {
          return {
            rows: [{ salt_id: 1, salt_name: 'Paracetamol', is_active: true }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (sql.includes('SELECT salt_id FROM salts WHERE LOWER(TRIM(salt_name)) = LOWER($1) AND salt_id != $2')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('UPDATE salts')) {
          return {
            rows: [
              {
                salt_id: 1,
                salt_name: 'Paracetamol BP',
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
        .patch('/api/v1/salts/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ saltName: 'Paracetamol BP' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.SALT_UPDATED);
      expect(res.body.data.saltName).toBe('Paracetamol BP');
    });
  });
});
