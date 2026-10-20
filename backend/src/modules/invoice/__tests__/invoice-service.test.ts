import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoiceService } from '../invoice.service.js';
import * as db from '../../../config/db.js';
import * as storage from '../../../utils/storage.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../errors/app-error.js';

describe('Invoice Generation Service (Plan 9-03)', () => {
  const orderId = 101;
  const retailerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates an invoice for a DELIVERED order with accepted items, computing single GST and round-off', async () => {
    let insertedInvoice: any = null;

    vi.spyOn(storage, 'uploadInvoicePdf').mockResolvedValue('uploads/invoices/INV_2026-27_00001.pdf');

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      // 1. Idempotency check
      if (sql.includes('SELECT * FROM invoices WHERE order_id = $1')) {
        if (insertedInvoice) {
          return { rows: [insertedInvoice], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      }

      // 2. Order & retailer lookup
      if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
        return {
          rows: [
            {
              order_id: orderId,
              order_number: 'ORD-000101',
              status: 'DELIVERED',
              created_at: new Date('2026-10-20T08:00:00Z'),
              retailer_id: retailerId,
              username: 'shree_pharmacy',
              user_phone: '9876543210',
              user_email: 'shree@pharma.com',
              shop_name: 'Shree Pharmacy',
              contact_person: 'Ramesh Patel',
              address_line: 'Near Station Road',
              city: 'Ahmedabad',
              state: 'Gujarat',
              pincode: '380001',
              whatsapp_number: '9876543210',
              gstin: '24AAAAA1234A1Z5',
              drug_license_number: 'GJ-AHM-00123',
            },
          ],
          rowCount: 1,
        } as any;
      }

      // 3. Accepted line items & allocations
      if (sql.includes('WHERE oi.order_id = $1 AND oi.delivery_status = \'ACCEPTED\'')) {
        return {
          rows: [
            {
              order_item_id: 201,
              medicine_id: 1,
              medicine_name: 'Paracetamol 650mg',
              pack_size: '10x10',
              gst_rate: 12, // 12% GST
              allocation_id: 301,
              batch_id: 11,
              allocated_quantity: 10,
              batch_number: 'BCH-P650',
              expiry_date: '2027-12-31',
              mrp: '35.00',
              selling_price: '25.00', // 25.00 * 10 = 250.00 subtotal, GST = 30.00
            },
            {
              order_item_id: 202,
              medicine_id: 2,
              medicine_name: 'Amoxicillin 500mg',
              pack_size: '10x6',
              gst_rate: 5, // 5% GST
              allocation_id: 302,
              batch_id: 12,
              allocated_quantity: 4,
              batch_number: 'BCH-A500',
              expiry_date: '2028-06-30',
              mrp: '100.00',
              selling_price: '70.00', // 70.00 * 4 = 280.00 subtotal, GST = 14.00
            },
          ],
          rowCount: 2,
        } as any;
      }

      // 4. App settings
      if (sql.includes('SELECT value FROM app_settings WHERE key = \'business_profile\'')) {
        return {
          rows: [
            {
              value: {
                name: 'Kandarp Drugs',
                address: 'Ahmedabad, Gujarat',
                gstin: '24AAAAA0000A1Z5',
                drugLicenseNumber: 'GJ-AHM-123456',
                phone: '+919876543210',
                email: 'billing@kandarpdrugs.com',
              },
            },
          ],
          rowCount: 1,
        } as any;
      }

      // 5. Sequence generator
      if (sql.includes('next_invoice_number_for_fy')) {
        return {
          rows: [{ next_invoice_number_for_fy: 'INV/2026-27/00001' }],
          rowCount: 1,
        } as any;
      }

      // 6. Insert invoice
      if (sql.includes('INSERT INTO invoices')) {
        insertedInvoice = {
          invoice_id: 1,
          invoice_number: params?.[0],
          order_id: params?.[1],
          retailer_id: params?.[2],
          billed_to: JSON.parse(params?.[3]),
          subtotal: params?.[4],
          gst_amount: params?.[5],
          round_off: params?.[6],
          total: params?.[7],
          pdf_path: params?.[8],
          generated_at: new Date('2026-10-20T10:00:00Z'),
        };
        return { rows: [insertedInvoice], rowCount: 1 } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const invoice = await invoiceService.generateInvoice(orderId);

    expect(invoice).toBeDefined();
    expect(invoice.invoiceNumber).toBe('INV/2026-27/00001');
    expect(invoice.orderNumber).toBe('ORD-000101');
    expect(invoice.subtotal).toBe('530.00'); // 250 + 280
    expect(invoice.gstAmount).toBe('44.00'); // 30 + 14
    expect(invoice.roundOff).toBe('0.00');
    expect(invoice.total).toBe('574.00'); // 530 + 44
    expect(invoice.lines).toHaveLength(2);
    expect(invoice.pdfPath).toBe('uploads/invoices/INV_2026-27_00001.pdf');
  });

  it('is idempotent: repeat calls return the existing invoice without inserting new row', async () => {
    const existingRow = {
      invoice_id: 42,
      invoice_number: 'INV/2026-27/00042',
      order_id: orderId,
      retailer_id: retailerId,
      billed_to: { shopName: 'Existing Pharmacy' },
      subtotal: '500.00',
      gst_amount: '60.00',
      round_off: '0.00',
      total: '560.00',
      pdf_path: 'uploads/invoices/INV_2026-27_00042.pdf',
      generated_at: new Date('2026-10-20T09:00:00Z'),
    };

    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM invoices WHERE order_id = $1')) {
        return { rows: [existingRow], rowCount: 1 } as any;
      }
      if (sql.includes('SELECT order_number FROM orders WHERE order_id = $1')) {
        return { rows: [{ order_number: 'ORD-000101' }], rowCount: 1 } as any;
      }
      if (sql.includes('WHERE oi.order_id = $1 AND oi.delivery_status = \'ACCEPTED\'')) {
        return { rows: [], rowCount: 0 } as any;
      }
      if (sql.includes('WHERE invoice_id = $1')) {
        return { rows: [], rowCount: 0 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const invoice = await invoiceService.generateInvoice(orderId);
    expect(invoice.invoiceId).toBe(42);
    expect(invoice.invoiceNumber).toBe('INV/2026-27/00042');
    expect(invoice.total).toBe('560.00');
  });

  it('rejects generating invoice for an order not in DELIVERED status (e.g. REJECTED or APPROVED)', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM invoices WHERE order_id = $1')) {
        return { rows: [], rowCount: 0 } as any;
      }
      if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
        return {
          rows: [
            {
              order_id: orderId,
              order_number: 'ORD-000101',
              status: 'REJECTED',
              retailer_id: retailerId,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    await expect(invoiceService.generateInvoice(orderId)).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError when order has 0 accepted line items', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM invoices WHERE order_id = $1')) {
        return { rows: [], rowCount: 0 } as any;
      }
      if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
        return {
          rows: [
            {
              order_id: orderId,
              order_number: 'ORD-000101',
              status: 'DELIVERED',
              retailer_id: retailerId,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      if (sql.includes('WHERE oi.order_id = $1 AND oi.delivery_status = \'ACCEPTED\'')) {
        return { rows: [], rowCount: 0 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    await expect(invoiceService.generateInvoice(orderId)).rejects.toThrow(ValidationError);
  });
});
