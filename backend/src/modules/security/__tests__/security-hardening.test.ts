import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import { signAccessToken, getRefreshCookieOptions } from '../../../utils/tokens.js';
import { USER_ROLE } from '../../../enums/user-role.enum.js';

describe('Security Hardening & Protection Tests (Plan 11-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Security Headers (Helmet)', () => {
    it('sets standard defensive security headers on responses', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const res = await request(app).get('/api/v1/health');
      expect([200, 503]).toContain(res.status);

      // Verify helmet headers
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-download-options']).toBe('noopen');
    });

    it('enforces CORS origin reflection and credentials header', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Authentication Cookie Scoping & Path Enforcement', () => {
    it('verifies refresh token cookie options specify HttpOnly and Path=/api/v1/auth', () => {
      const options = getRefreshCookieOptions();
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/api/v1/auth');
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Rate Limiting Protections', () => {
    it('returns 429 RATE_LIMITED when exceeding searchScanLimiter quota', async () => {
      const adminToken = signAccessToken({
        sub: '11111111-1111-4111-a111-111111111111',
        username: 'admin',
        role: USER_ROLE.ADMIN,
        phone: '9876543210',
        mustChangePassword: false,
      });

      // Mock user lookup in authenticate and search in controller
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: '11111111-1111-4111-a111-111111111111',
                username: 'admin',
                role: USER_ROLE.ADMIN,
                phone: '9876543210',
                is_active: true,
                must_change_password: false,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      let lastStatus = 200;
      let hit429 = false;

      // Rate limit is 60 requests per minute
      for (let i = 0; i < 65; i++) {
        const res = await request(app)
          .get('/api/v1/salts/suggest?q=paracetamol')
          .set('Authorization', `Bearer ${adminToken}`);

        lastStatus = res.status;
        if (res.status === 429) {
          hit429 = true;
          expect(res.body.code).toBe('RATE_LIMITED');
          expect(res.headers['x-ratelimit-remaining']).toBe('0');
          break;
        }
      }

      expect(hit429).toBe(true);
      expect(lastStatus).toBe(429);
    });
  });

  describe('Route Authorization Hardening', () => {
    it('rejects unauthenticated requests to protected endpoints with 401 AUTH_REQUIRED', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('rejects retailer role accessing admin user directory with 403 FORBIDDEN', async () => {
      const retailerToken = signAccessToken({
        sub: '22222222-2222-4222-a222-222222222222',
        username: 'retailer',
        role: USER_ROLE.RETAILER,
        phone: '9876543210',
        mustChangePassword: false,
      });

      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: '22222222-2222-4222-a222-222222222222',
                username: 'retailer',
                role: USER_ROLE.RETAILER,
                phone: '9876543210',
                is_active: true,
                must_change_password: false,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
