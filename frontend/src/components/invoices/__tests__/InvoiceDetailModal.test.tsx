import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { InvoiceDetailModal } from '../InvoiceDetailModal';
import * as invoiceApi from '@/lib/api/invoice.api';

describe('InvoiceDetailModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockInvoice: invoiceApi.InvoiceDetail = {
    invoiceId: 1,
    invoiceNumber: 'INV/2026-27/00001',
    orderId: 101,
    orderNumber: 'ORD-000101',
    retailerId: 'ret-1',
    billedTo: {
      shopName: 'Shree Pharmacy',
      contactPerson: 'Ramesh Patel',
      addressLine: 'Station Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380001',
      phone: '9876543210',
      gstin: '24AAAAA1234A1Z5',
      drugLicenseNumber: 'GJ-AHM-00123',
    },
    subtotal: '500.00',
    gstAmount: '60.00',
    roundOff: '0.00',
    total: '560.00',
    pdfPath: 'uploads/invoices/INV_2026-27_00001.pdf',
    generatedAt: '2026-10-20T10:00:00Z',
    lines: [
      {
        orderItemId: 1,
        medicineId: 10,
        medicineName: 'Paracetamol 500mg',
        packSize: '10x10 Tablets',
        batchId: 5,
        batchNumber: 'BATCH-001',
        expiryDate: '2027-12-31',
        quantity: 10,
        mrp: '60.00',
        unitPrice: '50.00',
        gstRate: 12,
        gstAmount: '60.00',
        lineTotal: '500.00',
      },
    ],
    notifications: [
      {
        logId: 1,
        channel: 'WHATSAPP',
        recipient: '9876543210',
        status: 'SENT',
        attempts: 1,
        providerMessageId: 'wamid-12345',
        createdAt: '2026-10-20T10:01:00Z',
      },
    ],
  };

  it('renders invoice details, line items, and notification timeline when open', async () => {
    vi.spyOn(invoiceApi, 'getInvoiceById').mockResolvedValue({
      success: true,
      code: 'INVOICE_RETRIEVED',
      message: 'OK',
      data: mockInvoice,
      meta: {
        requestId: 'req-1',
        timestamp: '2026-10-20T10:00:00Z',
      },
    });

    render(
      <InvoiceDetailModal
        invoiceId={1}
        isOpen={true}
        onClose={vi.fn()}
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Invoice: INV/2026-27/00001')).toBeDefined();
      expect(screen.getByText('Shree Pharmacy')).toBeDefined();
      expect(screen.getByText('Paracetamol 500mg')).toBeDefined();
      expect(screen.getByText('Dispatch & Notification Timeline')).toBeDefined();
      expect(screen.getByText('WHATSAPP')).toBeDefined();
      expect(screen.getByText('SENT')).toBeDefined();
    });
  });

  it('does not render modal when isOpen is false', () => {
    render(
      <InvoiceDetailModal
        invoiceId={1}
        isOpen={false}
        onClose={vi.fn()}
        isAdmin={false}
      />
    );

    expect(screen.queryByText('Invoice: INV/2026-27/00001')).toBeNull();
  });
});
