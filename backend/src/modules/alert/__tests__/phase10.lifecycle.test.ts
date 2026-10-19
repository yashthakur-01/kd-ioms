import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import { SUCCESS_CODES } from '../../../constants/success-codes.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { invalidateSettingsCache } from '../../settings/settings.service.js';

describe('Phase 10 E2E Operational Lifecycle Walkthrough', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin',
    role: 'ADMIN',
    phone: '9999999999',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateSettingsCache();
  });

  it('completes the entire Phase 10 operational lifecycle seamlessly', async () => {
    let currentThreshold = 60;
    let batchADismissedAt: Date | null = null;
    let batchBQuantity = 50;
    let writeOffLedgerLogged = false;

    // Mock Pool Client for transactional operations
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [], rowCount: 0 };
        }
        // Update settings query
        if (sql.includes('UPDATE app_settings') && sql.includes('expiry_alert_days')) {
          currentThreshold = params![0];
          return { rows: [], rowCount: 1 };
        }
        // Remove expired batch queries
        if (sql.includes('SELECT') && sql.includes('FROM batches') && sql.includes('FOR UPDATE')) {
          const batchId = params![0];
          if (batchId === 201) {
            // Batch A is unexpired
            return {
              rows: [{ batch_id: 201, expiry_date: '2099-12-31', quantity_on_hand: 100 }],
              rowCount: 1,
            };
          }
          if (batchId === 202) {
            // Batch B is expired
            return {
              rows: [{ batch_id: 202, expiry_date: '2026-01-01', quantity_on_hand: batchBQuantity }],
              rowCount: 1,
            };
          }
        }
        if (sql.includes('UPDATE batches SET quantity_on_hand')) {
          batchBQuantity = 0;
          return { rows: [{ batch_id: 202, quantity_on_hand: 0 }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO stock_ledger_entries')) {
          writeOffLedgerLogged = true;
          return { rows: [{ entry_id: 888, balance_after: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    vi.spyOn(db.pool, 'connect').mockResolvedValue(mockClient as any);

    // Mock db.query for reads
    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: adminId, username: 'admin', role: 'ADMIN', phone: '9999999999', is_active: true, must_change_password: false }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM app_settings')) {
        return {
          rows: [
            { key: 'expiry_alert_days', value: { days: currentThreshold } },
            {
              key: 'business_profile',
              value: {
                name: 'Kandarp Drugs',
                address: 'Ahmedabad',
                gstin: '24AAAAA0000A1Z5',
                drugLicenseNumber: 'GJ-AHM-123456',
                phone: '+919876543210',
                email: 'info@kandarpdrugs.com',
              },
            },
          ],
          rowCount: 2, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM v_expiry_alerts')) {
        // Return Batch A only if not dismissed
        if (batchADismissedAt) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return {
          rows: [
            {
              batch_id: 201,
              medicine_id: 1,
              medicine_name: 'Dolo 650',
              batch_number: 'BATCH-A',
              expiry_date: '2026-11-20',
              days_left: 32,
              quantity_on_hand: 100,
              mrp: '30.00',
              selling_price: '25.00',
              full_count: '1',
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM v_expired_stock')) {
        if (batchBQuantity <= 0) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return {
          rows: [
            {
              batch_id: 202,
              medicine_id: 2,
              medicine_name: 'Azithromycin 500',
              batch_number: 'BATCH-B',
              expiry_date: '2026-01-01',
              days_expired: 120,
              quantity_on_hand: batchBQuantity,
              mrp: '120.00',
              selling_price: '95.00',
              full_count: '1',
            },
          ],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      if (sql.includes('FROM batches') && sql.includes('batch_id = $1')) {
        const batchId = params![0];
        if (batchId === 201) {
          return {
            rows: [{ batch_id: 201, medicine_id: 1, batch_number: 'BATCH-A', expiry_date: '2026-11-20', is_expired: false }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
        if (batchId === 202) {
          return {
            rows: [{ batch_id: 202, medicine_id: 2, batch_number: 'BATCH-B', expiry_date: '2026-01-01', is_expired: true }],
            rowCount: 1, command: '', oid: 0, fields: [],
          };
        }
      }
      if (sql.includes('UPDATE batches') && sql.includes('expiry_alert_dismissed_at = NOW()')) {
        batchADismissedAt = new Date();
        return {
          rows: [{ batch_id: 201, medicine_id: 1, batch_number: 'BATCH-A', expiry_date: '2026-11-20', expiry_alert_dismissed_at: batchADismissedAt }],
          rowCount: 1, command: '', oid: 0, fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    // Mock db.pool.query for dashboard summary
    vi.spyOn(db.pool, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM v_expiry_alerts')) {
        return { rows: [{ count: batchADismissedAt ? 0 : 1 }], rowCount: 1 } as any;
      }
      if (sql.includes('FROM v_expired_stock')) {
        return { rows: [{ count: batchBQuantity > 0 ? 1 : 0 }], rowCount: 1 } as any;
      }
      return { rows: [{ count: 0 }], rowCount: 1 } as any;
    });

    // -------------------------------------------------------------------------
    // Step 1: Initial Settings & Dynamic Threshold Update
    // -------------------------------------------------------------------------
    const settingsGet1 = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(settingsGet1.status).toBe(200);
    expect(settingsGet1.body.data.expiryAlertDays).toBe(60);

    const settingsPatch = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiryAlertDays: 90 });
    expect(settingsPatch.status).toBe(200);
    expect(settingsPatch.body.data.expiryAlertDays).toBe(90);

    // -------------------------------------------------------------------------
    // Step 2: Near Expiry Alerts Querying
    // -------------------------------------------------------------------------
    const nearExpiryRes1 = await request(app)
      .get('/api/v1/alerts/near-expiry')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(nearExpiryRes1.status).toBe(200);
    expect(nearExpiryRes1.body.data).toHaveLength(1);
    expect(nearExpiryRes1.body.data[0].batchNumber).toBe('BATCH-A');

    // -------------------------------------------------------------------------
    // Step 3: Dismiss Batch A ("Keep as it is")
    // -------------------------------------------------------------------------
    const dismissRes = await request(app)
      .post('/api/v1/alerts/near-expiry/201/dismiss')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.code).toBe(SUCCESS_CODES.NEAR_EXPIRY_DISMISSED);
    expect(batchADismissedAt).toBeDefined();

    // After dismissal, Batch A no longer appears in near-expiry
    const nearExpiryRes2 = await request(app)
      .get('/api/v1/alerts/near-expiry')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(nearExpiryRes2.status).toBe(200);
    expect(nearExpiryRes2.body.data).toHaveLength(0);

    // -------------------------------------------------------------------------
    // Step 4: Expired Stock Operations & Physical Removal Write-Off
    // -------------------------------------------------------------------------
    // Attempting to dismiss already expired Batch B is rejected with 409
    const dismissExpiredAttempt = await request(app)
      .post('/api/v1/alerts/near-expiry/202/dismiss')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dismissExpiredAttempt.status).toBe(409);
    expect(dismissExpiredAttempt.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);

    // Expired stock view lists Batch B
    const expiredRes1 = await request(app)
      .get('/api/v1/alerts/expired')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(expiredRes1.status).toBe(200);
    expect(expiredRes1.body.data).toHaveLength(1);
    expect(expiredRes1.body.data[0].batchNumber).toBe('BATCH-B');

    // Attempting to remove-expired Batch A (unexpired) is rejected with 409
    const removeUnexpiredAttempt = await request(app)
      .post('/api/v1/batches/201/remove-expired')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Premature disposal' });
    expect(removeUnexpiredAttempt.status).toBe(409);
    expect(removeUnexpiredAttempt.body.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);

    // Execute physical write-off on expired Batch B
    const removeExpiredRes = await request(app)
      .post('/api/v1/batches/202/remove-expired')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Disposed in hospital hazard container' });
    expect(removeExpiredRes.status).toBe(200);
    expect(removeExpiredRes.body.code).toBe(SUCCESS_CODES.EXPIRED_BATCH_REMOVED);
    expect(removeExpiredRes.body.data.removedQuantity).toBe(50);
    expect(removeExpiredRes.body.data.balanceAfter).toBe(0);
    expect(writeOffLedgerLogged).toBe(true);

    // After write-off, Batch B leaves expired stock view
    const expiredRes2 = await request(app)
      .get('/api/v1/alerts/expired')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(expiredRes2.status).toBe(200);
    expect(expiredRes2.body.data).toHaveLength(0);

    // -------------------------------------------------------------------------
    // Step 5: Dashboard Summary Total Reconciliation
    // -------------------------------------------------------------------------
    const dashboardSummary = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashboardSummary.status).toBe(200);
    expect(dashboardSummary.body.data.nearExpiryBatches).toBe(0);
    expect(dashboardSummary.body.data.expiredBatches).toBe(0);
  });
});
