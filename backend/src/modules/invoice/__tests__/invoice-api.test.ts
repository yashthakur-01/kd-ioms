import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import * as storage from '../../../utils/storage.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { USER_ROLE } from '../../../enums/user-role.enum.js';
import { invoiceService } from '../invoice.service.js';
import { notificationService } from '../../notification/notification.service.js';

describe('Invoices HTTP API & Authorization (Plan 9-05)', () => {
  const adminId = '11111111-1111-4111-a111-111111111111';
  const retailerAId = '22222222-2222-4222-a222-222222222222';
  const retailerBId = '33333333-3333-4333-a333-333333333333';

  const adminToken = tokensUtils.signAccessToken({
    sub: adminId,
    username: 'admin_user',
    role: USER_ROLE.ADMIN,
    phone: '9999999999',
    mustChangePassword: false,
  });

  const retailerAToken = tokensUtils.signAccessToken({
    sub: retailerAId,
    username: 'retailer_a',
    role: USER_ROLE.RETAILER,
    phone: '9888888888',
    mustChangePassword: false,
  });

  const retailerBToken = tokensUtils.signAccessToken({
    sub: retailerBId,
    username: 'retailer_b',
    role: USER_ROLE.RETAILER,
    phone: '9777777777',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      // Auth middleware user query
      if (sql.includes('FROM users WHERE id = $1')) {
        const id = params?.[0];
        let role = USER_ROLE.RETAILER;
        let username = 'retailer_a';
        if (id === adminId) {
          role = USER_ROLE.ADMIN;
          username = 'admin_user';
        } else if (id === retailerBId) {
          role = USER_ROLE.RETAILER;
          username = 'retailer_b';
        }
        return {
          rows: [
            {
              id,
              username,
              role,
              must_change_password: false,
              is_active: true,
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });
  });

  describe('GET /api/v1/invoices', () => {
    it('allows Admin to list all invoices with pagination', async () => {
      vi.spyOn(invoiceService, 'listInvoices').mockResolvedValue({
        items: [
          {
            invoiceId: 10,
            invoiceNumber: 'INV/2026-27/00010',
            orderId: 101,
            orderNumber: 'ORD-000101',
            retailerId: retailerAId,
            shopName: 'Pharmacy A',
            subtotal: '1000.00',
            gstAmount: '120.00',
            roundOff: '0.00',
            total: '1120.00',
            pdfPath: 'uploads/invoices/inv.pdf',
            generatedAt: '2026-10-20T10:00:00.000Z',
            latestNotification: { channel: 'WHATSAPP', status: 'SENT' },
          },
        ],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('INVOICES_RETRIEVED');
      expect(res.body.data).toHaveLength(1);
    });

    it('forces Retailer query to their own userId', async () => {
      const listSpy = vi.spyOn(invoiceService, 'listInvoices').mockResolvedValue({
        items: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      });

      // Retailer A passes a foreign retailerId
      const res = await request(app)
        .get(`/api/v1/invoices?retailerId=${retailerBId}`)
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          retailerId: retailerAId, // Must be forced to Retailer A's own ID
        })
      );
    });
  });

  describe('GET /api/v1/invoices/:invoiceId (Tenant Isolation)', () => {
    it('returns 200 for Retailer A viewing their own invoice', async () => {
      vi.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue({
        invoiceId: 20,
        invoiceNumber: 'INV/2026-27/00020',
        orderId: 201,
        orderNumber: 'ORD-000201',
        retailerId: retailerAId, // belongs to Retailer A
        billedTo: { shopName: 'Pharmacy A', addressLine: 'Road', city: 'Ahmd', state: 'GJ', pincode: '380001', phone: '9888888888' },
        subtotal: '500.00',
        gstAmount: '60.00',
        roundOff: '0.00',
        total: '560.00',
        pdfPath: 'uploads/invoices/inv.pdf',
        generatedAt: '2026-10-20T10:00:00.000Z',
      });

      const res = await request(app)
        .get('/api/v1/invoices/20')
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('INVOICE_RETRIEVED');
      expect(res.body.data.invoiceId).toBe(20);
    });

    it('returns 404 NOT_FOUND when Retailer B attempts to access Retailer A\'s invoice (ADR-026/043)', async () => {
      vi.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue({
        invoiceId: 20,
        invoiceNumber: 'INV/2026-27/00020',
        orderId: 201,
        orderNumber: 'ORD-000201',
        retailerId: retailerAId, // belongs to Retailer A!
        billedTo: { shopName: 'Pharmacy A', addressLine: 'Road', city: 'Ahmd', state: 'GJ', pincode: '380001', phone: '9888888888' },
        subtotal: '500.00',
        gstAmount: '60.00',
        roundOff: '0.00',
        total: '560.00',
        pdfPath: 'uploads/invoices/inv.pdf',
        generatedAt: '2026-10-20T10:00:00.000Z',
      });

      const res = await request(app)
        .get('/api/v1/invoices/20')
        .set('Authorization', `Bearer ${retailerBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });

  describe('GET /api/v1/invoices/:invoiceId/pdf', () => {
    it('returns signed download URL with 300s TTL', async () => {
      vi.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue({
        invoiceId: 25,
        invoiceNumber: 'INV/2026-27/00025',
        orderId: 205,
        orderNumber: 'ORD-000205',
        retailerId: retailerAId,
        billedTo: { shopName: 'Pharmacy A', addressLine: 'Road', city: 'Ahmd', state: 'GJ', pincode: '380001', phone: '9888888888' },
        subtotal: '500.00',
        gstAmount: '60.00',
        roundOff: '0.00',
        total: '560.00',
        pdfPath: 'invoices/INV_2026-27_00025.pdf',
        generatedAt: '2026-10-20T10:00:00.000Z',
      });

      vi.spyOn(storage, 'getInvoicePdfSignedUrl').mockResolvedValue('https://storage.supabase.co/signed/INV_2026-27_00025.pdf?token=abc');

      const res = await request(app)
        .get('/api/v1/invoices/25/pdf')
        .set('Authorization', `Bearer ${retailerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('INVOICE_PDF_URL_GENERATED');
      expect(res.body.data.url).toContain('https://storage.supabase.co/signed/');
      expect(res.body.data.expiresIn).toBe(300);
    });
  });

  describe('POST /api/v1/invoices/:invoiceId/resend', () => {
    it('forbids non-Admin users from resending notifications', async () => {
      const res = await request(app)
        .post('/api/v1/invoices/25/resend')
        .set('Authorization', `Bearer ${retailerAToken}`)
        .send({ channel: 'WHATSAPP' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows Admin to trigger resend, returning 202 Accepted and updated logs', async () => {
      vi.spyOn(notificationService, 'sendInvoiceNotification').mockResolvedValue([
        {
          logId: 99,
          invoiceId: 25,
          channel: 'WHATSAPP',
          recipient: '9876543210',
          status: 'SENT',
          attempts: 1,
          providerMessageId: 'mock-wamid-12345',
          errorMessage: null,
          lastAttemptAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]);

      const res = await request(app)
        .post('/api/v1/invoices/25/resend')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ channel: 'WHATSAPP' });

      expect(res.status).toBe(202);
      expect(res.body.code).toBe('NOTIFICATION_RESENT');
      expect(res.body.data.logs).toHaveLength(1);
    });
  });
});
