import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('User Admin Integration Endpoints (/api/v1/users)', () => {
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

  describe('POST /api/v1/users', () => {
    it('returns 403 FORBIDDEN when called by non-admin', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
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
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          username: 'newretailer',
          role: 'RETAILER',
          phone: '9876543210',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 400 VALIDATION_ERROR when trying to create an ADMIN role account', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
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

      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'anotheradmin',
          role: 'ADMIN',
          phone: '9876543210',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('creates a retailer user and returns single-view temporary password', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
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
        if (sql.includes('INSERT INTO users')) {
          return {
            rows: [
              {
                id: 'new-user-id',
                username: 'chemist123',
                role: 'RETAILER',
                phone: '9876543210',
                is_active: true,
                must_change_password: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
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
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'chemist123',
          role: 'RETAILER',
          phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.USER_CREATED);
      expect(res.body.data.user.username).toBe('chemist123');
      expect(res.body.data.temporaryPassword).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
    });
  });

  describe('GET /api/v1/users', () => {
    it('lists users with pagination metadata', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
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
        if (sql.includes('SELECT COUNT(*) AS total FROM users')) {
          return { rows: [{ total: '1' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password, created_at, updated_at')) {
          return {
            rows: [
              {
                id: retailerId,
                username: 'retailer',
                role: 'RETAILER',
                phone: '9876543210',
                is_active: true,
                must_change_password: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
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
        .get('/api/v1/users?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.USERS_LISTED);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.pagination.totalItems).toBe(1);
    });
  });

  describe('PATCH /api/v1/users/:userId', () => {
    it('prevents admin from deactivating their own account', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
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

      const res = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('POST /api/v1/users/:userId/reset-password', () => {
    it('resets user password, generating a temporary password and revoking sessions', async () => {
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params: any = []) => {
        if (sql.includes('users') && sql.includes('WHERE id = $1')) {
          if (params[0] === adminId) {
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
          if (params[0] === retailerId) {
            return {
              rows: [
                {
                  id: retailerId,
                  username: 'retailer',
                  role: 'RETAILER',
                  phone: '9876543210',
                  is_active: true,
                  must_change_password: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              rowCount: 1,
              command: '',
              oid: 0,
              fields: [],
            };
          }
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => {
        const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        return fn(mockClient);
      });

      const res = await request(app)
        .post(`/api/v1/users/${retailerId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.PASSWORD_RESET);
      expect(res.body.data.temporaryPassword).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
    });
  });
});
