import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderPickView } from '../OrderPickView';
import * as ordersApi from '../../../lib/api/orders.api';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({ orderId: '10' }),
  usePathname: () => '/orders/10/pick',
}));

// Mock useAuth
vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'ADMIN', username: 'admin' },
    isAuthenticated: true,
  }),
}));

// Mock ToastProvider
vi.mock('../../../providers/ToastProvider', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
  }),
}));

describe('OrderPickView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const sampleSuggestions: ordersApi.OrderPickSuggestionsResult = {
    orderId: 10,
    orderNumber: 'ORD-000010',
    items: [
      {
        orderItemId: 1,
        medicineId: 101,
        medicineName: 'Augmentin 625 Duo',
        company: 'GSK',
        packSize: '10 Tablets',
        requestedQuantity: 5,
        quotedPriceInclGst: '90.00',
        suggestedTotalPicked: 5,
        shortfall: 0,
        batches: [
          {
            batchId: 10,
            batchNumber: 'AUG-B101',
            expiryDate: '2027-12-31',
            quantityOnHand: 20,
            sellingPrice: '80.00',
            mrp: '100.00',
            gstRate: '12.00',
            priceInclGst: '89.60',
            withinQuote: true,
            suggestedQty: 5,
          },
        ],
      },
    ],
  };

  it('renders pick view header, items, and automatically applies FEFO suggestions', async () => {
    vi.spyOn(ordersApi, 'getPickSuggestions').mockResolvedValueOnce({
      success: true,
      code: 'OK',
      message: 'Suggestions fetched',
      data: sampleSuggestions,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrderPickView orderId={10} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pick & Approve Order ORD-000010/)).toBeDefined();
      expect(screen.getByText('Augmentin 625 Duo')).toBeDefined();
      expect(screen.getByText(/Approve Order \(5\/5\)/)).toBeDefined();
    });
  });

  it('approves order when Approve Order button is clicked', async () => {
    vi.spyOn(ordersApi, 'getPickSuggestions').mockResolvedValueOnce({
      success: true,
      code: 'OK',
      message: 'Suggestions fetched',
      data: sampleSuggestions,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    const approveSpy = vi.spyOn(ordersApi, 'approveOrder').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_APPROVED',
      message: 'Approved',
      data: {
        orderId: 10,
        orderNumber: 'ORD-000010',
        status: 'APPROVED',
        items: [],
      },
      meta: { requestId: 'req_2', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrderPickView orderId={10} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Approve Order \(5\/5\)/)).toBeDefined();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve Order/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(10, {
        picks: [
          {
            orderItemId: 1,
            allocations: [
              {
                batchId: 10,
                quantity: 5,
                captureMethod: 'MANUAL',
                scannedPayload: undefined,
              },
            ],
          },
        ],
      });
    });
  });

  it('opens reject modal and triggers rejection', async () => {
    vi.spyOn(ordersApi, 'getPickSuggestions').mockResolvedValueOnce({
      success: true,
      code: 'OK',
      message: 'Suggestions fetched',
      data: sampleSuggestions,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    const rejectSpy = vi.spyOn(ordersApi, 'rejectOrder').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_REJECTED',
      message: 'Rejected',
      data: {
        orderId: 10,
        orderNumber: 'ORD-000010',
        status: 'REJECTED',
        rejectionReason: 'Stock damaged or expired on shelf',
      },
      meta: { requestId: 'req_3', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrderPickView orderId={10} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reject Order/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reject Order/i }));

    // Preset button
    const presetBtn = screen.getByText('Stock damaged or expired on shelf');
    fireEvent.click(presetBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(10, 'Stock damaged or expired on shelf');
    });
  });
});
