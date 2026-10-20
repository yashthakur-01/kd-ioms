import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdminInvoicesPage from '../page';
import * as invoiceApi from '@/lib/api/invoice.api';

describe('AdminInvoicesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page header and invoices table with data', async () => {
    vi.spyOn(invoiceApi, 'getInvoices').mockResolvedValue({
      success: true,
      code: 'INVOICES_RETRIEVED',
      message: 'OK',
      data: [
        {
          invoiceId: 1,
          invoiceNumber: 'INV/2026-27/00001',
          orderId: 101,
          orderNumber: 'ORD-000101',
          retailerId: 'ret-1',
          shopName: 'Shree Pharmacy',
          subtotal: '500.00',
          gstAmount: '60.00',
          roundOff: '0.00',
          total: '560.00',
          pdfPath: 'uploads/invoices/INV_2026-27_00001.pdf',
          generatedAt: '2026-10-20T10:00:00Z',
          latestNotification: {
            channel: 'WHATSAPP',
            status: 'SENT',
          },
        },
      ],
      meta: {
        requestId: 'req-1',
        timestamp: '',
        pagination: { page: 1, pageSize: 15, totalItems: 1, totalPages: 1 },
      },
    });

    render(<AdminInvoicesPage />);

    expect(screen.getByText('Wholesale Tax Invoices')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('INV/2026-27/00001')).toBeDefined();
      expect(screen.getByText('Shree Pharmacy')).toBeDefined();
      expect(screen.getByText('ORD-000101')).toBeDefined();
      expect(screen.getByText('WHATSAPP SENT')).toBeDefined();
    });
  });

  it('renders empty state when no invoices found', async () => {
    vi.spyOn(invoiceApi, 'getInvoices').mockResolvedValue({
      success: true,
      code: 'INVOICES_RETRIEVED',
      message: 'OK',
      data: [],
      meta: {
        requestId: 'req-2',
        timestamp: '',
        pagination: { page: 1, pageSize: 15, totalItems: 0, totalPages: 1 },
      },
    });

    render(<AdminInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('No Invoices Found')).toBeDefined();
    });
  });
});
