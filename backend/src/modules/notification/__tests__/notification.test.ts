import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notificationService } from '../notification.service.js';
import { processNotificationRetries } from '../../../jobs/notification-retry.js';
import * as db from '../../../config/db.js';
import * as storage from '../../../utils/storage.js';

describe('Multi-Channel Cascade Notification Service (Plan 9-04)', () => {
  const invoiceId = 55;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MOCK_WHATSAPP_FAIL;
    delete process.env.MOCK_EMAIL_FAIL;
  });

  afterEach(() => {
    delete process.env.MOCK_WHATSAPP_FAIL;
    delete process.env.MOCK_EMAIL_FAIL;
  });

  it('dispatches via WhatsApp primarily and logs status SENT on success', async () => {
    const logsStore: any[] = [];
    let logIdSeq = 1;

    vi.spyOn(storage, 'getInvoicePdfSignedUrl').mockResolvedValue('https://storage.supabase.co/signed/inv.pdf');

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM invoices i') && sql.includes('WHERE i.invoice_id = $1')) {
        return {
          rows: [
            {
              invoice_id: invoiceId,
              invoice_number: 'INV/2026-27/00055',
              total: '2450.00',
              pdf_path: 'uploads/invoices/INV_2026-27_00055.pdf',
              billed_to: { shopName: 'Apollo Pharmacy' },
              user_email: 'apollo@pharmacy.com',
              user_phone: '9876543210',
              shop_name: 'Apollo Pharmacy',
              whatsapp_number: '9876543210',
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('INSERT INTO notification_logs')) {
        const isEmail = sql.includes('\'EMAIL\'');
        const row = {
          log_id: logIdSeq++,
          invoice_id: params?.[0],
          channel: isEmail ? 'EMAIL' : 'WHATSAPP',
          recipient: params?.[1],
          status: 'PENDING',
          attempts: 1,
          provider_message_id: null,
          error_message: null,
          last_attempt_at: new Date(),
          created_at: new Date(),
        };
        logsStore.push(row);
        return { rows: [row], rowCount: 1 } as any;
      }

      if (sql.includes('UPDATE notification_logs') && sql.includes('status = \'SENT\'')) {
        const logId = params?.[1];
        const log = logsStore.find((l) => l.log_id === logId);
        if (log) {
          log.status = 'SENT';
          log.provider_message_id = params?.[0];
        }
        return { rows: log ? [log] : [], rowCount: 1 } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const logs = await notificationService.sendInvoiceNotification(invoiceId);

    expect(logs).toHaveLength(1);
    expect(logs[0]?.channel).toBe('WHATSAPP');
    expect(logs[0]?.status).toBe('SENT');
    expect(logs[0]?.providerMessageId).toMatch(/^mock-wamid-/);
  });

  it('cascades to Email fallback when WhatsApp fails and retailer has an email (ADR-042)', async () => {
    process.env.MOCK_WHATSAPP_FAIL = 'true'; // Simulate WhatsApp failure

    const logsStore: any[] = [];
    let logIdSeq = 1;

    vi.spyOn(storage, 'getInvoicePdfSignedUrl').mockResolvedValue('https://storage.supabase.co/signed/inv.pdf');

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM invoices i') && sql.includes('WHERE i.invoice_id = $1')) {
        return {
          rows: [
            {
              invoice_id: invoiceId,
              invoice_number: 'INV/2026-27/00055',
              total: '2450.00',
              pdf_path: 'uploads/invoices/INV_2026-27_00055.pdf',
              billed_to: { shopName: 'Apollo Pharmacy' },
              user_email: 'apollo@pharmacy.com',
              user_phone: '9876543210',
              shop_name: 'Apollo Pharmacy',
              whatsapp_number: '9876543210',
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('INSERT INTO notification_logs')) {
        const isEmail = sql.includes('\'EMAIL\'');
        const row = {
          log_id: logIdSeq++,
          invoice_id: params?.[0],
          channel: isEmail ? 'EMAIL' : 'WHATSAPP',
          recipient: params?.[1],
          status: 'PENDING',
          attempts: 1,
          provider_message_id: null,
          error_message: null,
          last_attempt_at: new Date(),
          created_at: new Date(),
        };
        logsStore.push(row);
        return { rows: [row], rowCount: 1 } as any;
      }

      if (sql.includes('UPDATE notification_logs') && sql.includes('status = \'FAILED\'')) {
        const logId = params?.[1];
        const log = logsStore.find((l) => l.log_id === logId);
        if (log) {
          log.status = 'FAILED';
          log.error_message = params?.[0];
        }
        return { rows: log ? [log] : [], rowCount: 1 } as any;
      }

      if (sql.includes('UPDATE notification_logs') && sql.includes('status = \'SENT\'')) {
        const logId = params?.[1];
        const log = logsStore.find((l) => l.log_id === logId);
        if (log) {
          log.status = 'SENT';
          log.provider_message_id = params?.[0];
        }
        return { rows: log ? [log] : [], rowCount: 1 } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const logs = await notificationService.sendInvoiceNotification(invoiceId);

    expect(logs).toHaveLength(2);
    // WhatsApp failed
    expect(logs[0]?.channel).toBe('WHATSAPP');
    expect(logs[0]?.status).toBe('FAILED');
    expect(logs[0]?.errorMessage).toContain('Meta Cloud API simulated service error');

    // Email fallback succeeded
    expect(logs[1]?.channel).toBe('EMAIL');
    expect(logs[1]?.status).toBe('SENT');
    expect(logs[1]?.recipient).toBe('apollo@pharmacy.com');
  });

  it('notification retry worker retries failed logs and marks FAILED after 3 attempts', async () => {
    vi.spyOn(storage, 'getInvoicePdfSignedUrl').mockResolvedValue('https://storage.supabase.co/signed/inv.pdf');

    process.env.MOCK_WHATSAPP_FAIL = 'true'; // Keep failing

    const mockPendingLogs = [
      {
        log_id: 10,
        invoice_id: invoiceId,
        channel: 'WHATSAPP',
        recipient: '9876543210',
        attempts: 2, // 2 previous attempts
        invoice_number: 'INV/2026-27/00055',
        total: '1000.00',
        pdf_path: 'uploads/invoices/test.pdf',
        billed_to: { shopName: 'Pharmacy' },
        shop_name: 'Pharmacy',
      },
    ];

    let updatedStatus = '';
    let updatedAttempts = 0;

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT') && sql.includes('FROM notification_logs nl')) {
        return { rows: mockPendingLogs, rowCount: 1 } as any;
      }
      if (sql.includes('UPDATE notification_logs') && sql.includes('attempts = $1')) {
        updatedAttempts = params?.[0];
        updatedStatus = 'FAILED';
        return { rows: [], rowCount: 1 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await processNotificationRetries();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(updatedAttempts).toBe(3);
    expect(updatedStatus).toBe('FAILED');
  });
});
