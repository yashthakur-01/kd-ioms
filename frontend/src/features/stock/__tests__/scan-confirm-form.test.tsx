import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScanConfirmForm } from '../components/ScanConfirmForm';
import * as stockApi from '../api';

describe('ScanConfirmForm Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('renders pre-populated values and dynamically calculates price incl. GST', () => {
    renderWithProviders(
      <ScanConfirmForm
        initialValues={{
          medicineId: 1,
          medicineName: 'Paracetamol 500mg',
          medicineCompany: 'Acme Pharma',
          gstRate: 12,
          batchNumber: 'B-101',
          expiryDate: '2028-10-18',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 20,
        }}
      />
    );

    expect(screen.getByText('Paracetamol 500mg')).toBeDefined();
    expect(screen.getByDisplayValue('B-101')).toBeDefined();
    // 80.00 * 1.12 = 89.60
    expect(screen.getByText('₹89.60')).toBeDefined();
  });

  it('displays warning when selling price incl. GST exceeds MRP ceiling', async () => {
    renderWithProviders(
      <ScanConfirmForm
        initialValues={{
          medicineId: 1,
          medicineName: 'Paracetamol 500mg',
          gstRate: 12,
          batchNumber: 'B-102',
          expiryDate: '2028-10-18',
          mrp: '100.00',
          sellingPrice: '95.00', // 95 * 1.12 = 106.40 > 100.00
          quantity: 10,
        }}
      />
    );

    // Warning message
    expect(screen.getByText(/Exceeds MRP ceiling of ₹100.00/i)).toBeDefined();
    // Submit button should be disabled
    const submitBtn = screen.getByRole('button', { name: /Confirm & Inward Stock/i });
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('submits valid form data and renders success state', async () => {
    const inwardSpy = vi.spyOn(stockApi, 'inwardStock').mockResolvedValue({
      success: true,
      code: 'STOCK_INWARD_RECORDED',
      message: 'Stock inward recorded',
      data: {
        action: 'CREATED',
        batch: {
          batchId: 10,
          medicineId: 1,
          batchNumber: 'B-103',
          expiryDate: '2028-10-18',
          mrp: '100.00',
          sellingPrice: '80.00',
          purchaseRate: '60.00',
          quantityOnHand: 25,
          status: 'ACTIVE',
          gtin: null,
        },
        ledgerEntry: {
          entryId: 99,
          type: 'INWARD',
          delta: 25,
          balanceAfter: 25,
        },
      },
      meta: {
        requestId: 'req_123',
        timestamp: new Date().toISOString(),
      },
    });

    renderWithProviders(
      <ScanConfirmForm
        initialValues={{
          medicineId: 1,
          medicineName: 'Paracetamol 500mg',
          gstRate: 12,
          batchNumber: 'B-103',
          expiryDate: '2028-10-18',
          mrp: '100.00',
          sellingPrice: '80.00',
          quantity: 25,
        }}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Confirm & Inward Stock/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(inwardSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Stock Inward Successfully Recorded!/i)).toBeDefined();
      expect(screen.getByText(/25 units/i)).toBeDefined();
    });
  });
});
