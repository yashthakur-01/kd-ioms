import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as cryptoUtils from '../../../utils/crypto.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';

describe('Auth Integration Endpoints (/api/v1/auth)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 VALIDATION_ERROR on invalid username format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'a', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 401 AUTH_INVALID_CREDENTIALS when user does not exist', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    });

    it('returns 403 AUTH_ACCOUNT_LOCKED when account is currently locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [
          {
            id: 'mock-id',
            username: 'lockeduser',
            password_hash: '$2a$12$somehash',
            role: 'RETAILER',
            phone: '9876543210',
            is_active: true,
            must_change_password: false,
            failed_login_count: 5,
            locked_until: futureDate,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'lockeduser', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_ACCOUNT_LOCKED);
    });

    it('returns 200 and sets refresh cookie on successful credentials', async () => {
      const passwordHash = await cryptoUtils.hashPassword('CorrectPass123!');

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, password_hash')) {
          return {
            rows: [
              {
                id: 'mock-user-1',
                username: 'validuser',
                password_hash: passwordHash,
                role: 'RETAILER',
                phone: '9876543210',
                is_active: true,
                must_change_password: false,
                failed_login_count: 0,
                locked_until: null,
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 1, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'validuser', password: 'CorrectPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.AUTH_LOGGED_IN);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.username).toBe('validuser');

      // Assert Set-Cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 AUTH_REFRESH_INVALID when no cookie is sent', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REFRESH_INVALID);
    });

    it('rotates refresh token and returns new access token on valid cookie', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        is_revoked: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const mockUser = {
        id: 'user-123',
        username: 'sessionuser',
        role: 'RETAILER',
        phone: '9876543210',
        is_active: true,
        must_change_password: false,
      };

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('auth_sessions') && sql.includes('refresh_token_hash')) {
          return { rows: [mockSession], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('users') && sql.includes('id = $1')) {
          return { rows: [mockUser], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => {
        const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        return fn(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=valid-mock-token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.AUTH_REFRESHED);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears refreshToken cookie and returns 200', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', ['refreshToken=some-token']);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(SUCCESS_CODES.AUTH_LOGGED_OUT);

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('refreshToken=;'))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user profile when authenticated', async () => {
      const token = tokensUtils.signAccessToken({
        sub: 'user-xyz',
        username: 'meuser',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: false,
      });

      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [
          {
            id: 'user-xyz',
            username: 'meuser',
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
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('meuser');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('successfully changes password and returns 200 with rotated token', async () => {
      const oldHash = await cryptoUtils.hashPassword('OldPass123!');
      const token = tokensUtils.signAccessToken({
        sub: 'user-change-1',
        username: 'changeme',
        role: 'RETAILER',
        phone: '9876543210',
        mustChangePassword: true,
      });

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'user-change-1',
                username: 'changeme',
                role: 'RETAILER',
                phone: '9876543210',
                is_active: true,
                must_change_password: true,
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        if (sql.includes('SELECT id, username, role, phone, password_hash FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'user-change-1',
                username: 'changeme',
                role: 'RETAILER',
                phone: '9876543210',
                password_hash: oldHash,
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          };
        }
        return { rows: [], rowCount: 1, command: '', oid: 0, fields: [] };
      });

      vi.spyOn(db, 'withTransaction').mockImplementation(async (fn: any) => {
        const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        return fn(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'BrandNewPass999!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe(SUCCESS_CODES.AUTH_PASSWORD_CHANGED);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });
});

