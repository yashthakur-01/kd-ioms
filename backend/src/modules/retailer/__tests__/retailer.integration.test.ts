import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { USER_ROLE } from '../../../enums/user-role.enum.js';

describe('Retailer Integration Endpoints (/api/v1/retailers)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const retailerId = '22222222-2222-4222-a222-222222222222';
  const targetRetailerId = '33333333-3333-4333-a333-333333333333';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin',
    role: USER_ROLE.ADMIN,
    phone: '9999999999',
    mustChangePassword: false,
  });

  const retailerToken = tokensUtils.signAccessToken({
    sub: retailerId,
    username: 'retailer',
    role: USER_ROLE.RETAILER,
    phone: '9876543210',
    mustChangePassword: false,
  });

  const deliveryId = '44444444-4444-4444-a444-444444444444';
  const deliveryToken = tokensUtils.signAccessToken({
    sub: deliveryId,
    username: 'delivery',
    role: USER_ROLE.DELIVERY,
    phone: '9888888888',
    mustChangePassword: false,
  });

  const validProfilePayload = {
    shopName: 'Shree Krishna Medical Stores',
    addressLine: '123 Station Road, Near Bus Stand',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    whatsappNumber: '9876543210',
    email: 'krishna.pharma@example.com',
    drugLicenseNumber: 'GJ-AH1-123456',
    gstin: '24AAAAA0000A1Z5',
  };

  const sampleProfileDbRow = {
    id: 'profile-uuid-1',
    user_id: retailerId,
    shop_name: 'Shree Krishna Medical Stores',
    address_line: '123 Station Road, Near Bus Stand',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    whatsapp_number: '9876543210',
    email: 'krishna.pharma@example.com',
    drug_license_number: 'GJ-AH1-123456',
    gstin: '24AAAAA0000A1Z5',
    approval_status: 'PENDING',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function setupAuthUserMock(currentUserId: string, role: string) {
    return (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1')) {
        return {
          rows: [
            {
              id: currentUserId,
              username: role === USER_ROLE.ADMIN ? 'admin' : 'retailer',
              role,
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
      return null;
    };
  }

  describe('GET /api/v1/retailers/me', () => {
    it('returns 401 AUTH_REQUIRED when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/retailers/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });

    it('returns 403 FORBIDDEN when accessed by ADMIN', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with null profile when retailer has not submitted KYC', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT * FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toBeNull();
      expect(res.body.data.approvalStatus).toBeNull();
    });

    it('returns 200 with profile and approvalStatus when submitted', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT * FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [sampleProfileDbRow], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.shopName).toBe('Shree Krishna Medical Stores');
      expect(res.body.data.approvalStatus).toBe('PENDING');
    });
  });

  describe('PUT /api/v1/retailers/me', () => {
    it('returns 400 VALIDATION_ERROR on invalid pincode or GSTIN format', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .put('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          ...validProfilePayload,
          pincode: '12345', // invalid length
          gstin: 'invalid-gstin',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 201 with upserted profile and PENDING status on initial submission', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        if (sql.includes('INSERT INTO retailer_profiles')) {
          return { rows: [sampleProfileDbRow], rowCount: 1, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .put('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(validProfilePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalStatus).toBe('PENDING');
      expect(res.body.data.profile.shopName).toBe('Shree Krishna Medical Stores');
    });

    it('returns 409 INVALID_STATE_TRANSITION when profile is already APPROVED', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'APPROVED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .put('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(validProfilePayload);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
      expect(res.body.message).toContain('Approved profiles cannot be edited directly');
    });

    it('returns 409 DUPLICATE_RESOURCE with field targeting when drugLicenseNumber violates unique constraint', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        if (sql.includes('INSERT INTO retailer_profiles')) {
          const pgError = new Error('duplicate key value violates unique constraint') as any;
          pgError.code = '23505';
          pgError.constraint = 'retailer_profiles_drug_license_number_key';
          pgError.detail = 'Key (drug_license_number)=(GJ-AH1-123456) already exists.';
          throw pgError;
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .put('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(validProfilePayload);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'drugLicenseNumber' }),
        ])
      );
    });

    it('returns 409 DUPLICATE_RESOURCE with field targeting when GSTIN violates unique constraint', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        if (sql.includes('INSERT INTO retailer_profiles')) {
          const pgError = new Error('duplicate key value violates unique constraint') as any;
          pgError.code = '23505';
          pgError.constraint = 'retailer_profiles_gstin_key';
          pgError.detail = 'Key (gstin)=(24AAAAA0000A1Z5) already exists.';
          throw pgError;
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .put('/api/v1/retailers/me')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(validProfilePayload);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.DUPLICATE_RESOURCE);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'gstin' }),
        ])
      );
    });
  });

  describe('GET /api/v1/retailers', () => {
    it('returns 403 FORBIDDEN when requested by RETAILER', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get('/api/v1/retailers')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 200 with list and pagination metadata when requested by ADMIN', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('FROM retailer_profiles rp')) {
          return {
            rows: [
              {
                ...sampleProfileDbRow,
                username: 'retailer1',
                user_phone: '9876543210',
                user_is_active: true,
                total_count: '1',
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
        .get('/api/v1/retailers?approvalStatus=PENDING&q=Krishna&page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].shopName).toBe('Shree Krishna Medical Stores');
      expect(res.body.meta.pagination.totalItems).toBe(1);
      expect(res.body.meta.pagination.page).toBe(1);
    });

    it('returns 200 with list when requested by DELIVERY', async () => {
      const authMock = setupAuthUserMock(deliveryId, USER_ROLE.DELIVERY);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('FROM retailer_profiles rp')) {
          return {
            rows: [
              {
                ...sampleProfileDbRow,
                username: 'retailer1',
                user_phone: '9876543210',
                user_is_active: true,
                total_count: '1',
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
        .get('/api/v1/retailers?approvalStatus=APPROVED')
        .set('Authorization', `Bearer ${deliveryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/v1/retailers/:userId', () => {
    it('returns 403 FORBIDDEN when requested by RETAILER', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get(`/api/v1/retailers/${targetRetailerId}`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 404 NOT_FOUND when target retailer does not exist', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('FROM retailer_profiles rp')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .get(`/api/v1/retailers/${targetRetailerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 200 with retailer details when found', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('FROM retailer_profiles rp')) {
          return {
            rows: [
              {
                ...sampleProfileDbRow,
                user_id: targetRetailerId,
                username: 'targetuser',
                user_phone: '9876543210',
                user_is_active: true,
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
        .get(`/api/v1/retailers/${targetRetailerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shopName).toBe('Shree Krishna Medical Stores');
      expect(res.body.data.username).toBe('targetuser');
    });
  });

  describe('POST /api/v1/retailers/:userId/approve', () => {
    it('returns 403 FORBIDDEN when requested by RETAILER', async () => {
      const authMock = setupAuthUserMock(retailerId, USER_ROLE.RETAILER);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post(`/api/v1/retailers/${targetRetailerId}/approve`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('returns 404 NOT_FOUND when target profile does not exist', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('UPDATE retailer_profiles')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post(`/api/v1/retailers/${targetRetailerId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('returns 409 INVALID_STATE_TRANSITION when profile is not PENDING', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('UPDATE retailer_profiles')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'APPROVED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post(`/api/v1/retailers/${targetRetailerId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
      expect(res.body.message).toContain('Only PENDING applications can be reviewed');
    });

    it('returns 200 with APPROVED status when application is PENDING', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('UPDATE retailer_profiles')) {
          return {
            rows: [
              {
                ...sampleProfileDbRow,
                user_id: targetRetailerId,
                approval_status: 'APPROVED',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
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
        .post(`/api/v1/retailers/${targetRetailerId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalStatus).toBe('APPROVED');
      expect(res.body.data.reviewedBy).toBe(adminId);
    });
  });

  describe('POST /api/v1/retailers/:userId/reject', () => {
    it('returns 400 VALIDATION_ERROR when rejection reason is missing or too short', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post(`/api/v1/retailers/${targetRetailerId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'abc' }); // less than 5 characters

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 409 INVALID_STATE_TRANSITION when profile is not PENDING', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('UPDATE retailer_profiles')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('SELECT approval_status FROM retailer_profiles WHERE user_id = $1')) {
          return { rows: [{ approval_status: 'REJECTED' }], rowCount: 1, command: '', oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      });

      const res = await request(app)
        .post(`/api/v1/retailers/${targetRetailerId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Drug license number is expired' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });

    it('returns 200 with REJECTED status and rejectionReason when valid', async () => {
      const authMock = setupAuthUserMock(adminId, USER_ROLE.ADMIN);
      const rejectionReason = 'Uploaded drug license is illegible and expired';
      vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
        const auth = authMock(sql, params);
        if (auth) return auth;

        if (sql.includes('UPDATE retailer_profiles')) {
          return {
            rows: [
              {
                ...sampleProfileDbRow,
                user_id: targetRetailerId,
                approval_status: 'REJECTED',
                rejection_reason: rejectionReason,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
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
        .post(`/api/v1/retailers/${targetRetailerId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: rejectionReason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalStatus).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe(rejectionReason);
    });
  });
});
