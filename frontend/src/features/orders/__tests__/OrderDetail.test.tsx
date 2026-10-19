import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OrderDetailView } from '../OrderDetailView';
import * as ordersApi from '../../../lib/api/orders.api';

// Mock useAuth
vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'retailer-1', role: 'RETAILER', username: 'apollo' },
    isAuthenticated: true,
  }),
}));

describe('OrderDetailView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleOrder: ordersApi.OrderDetailData = {
    orderId: 10,
    orderNumber: 'ORD-000010',
    status: 'PLACED',
    retailer: {
      id: 'retailer-1',
      username: 'apollo',
      pharmacyName: 'Apollo Pharmacy',
    },
    note: 'Call before delivery',
    createdAt: '2026-10-19T10:00:00Z',
    totalAmount: '450.00',
    itemCount: 1,
    items: [
      {
        orderItemId: 1,
        medicineId: 101,
        medicineName: 'Augmentin 625 Duo',
        company: 'GSK',
        packSize: '10 Tablets',
        gstRate: '12.00',
        requestedQuantity: 2,
        quotedPriceInclGst: '225.00',
        pickedQuantity: 0,
        fulfilmentStatus: 'NONE',
        deliveryStatus: 'PENDING',
      },
    ],
    history: [
      {
        historyId: 1,
        fromStatus: null,
        toStatus: 'PLACED',
        actorName: 'Apollo',
        note: 'Order placed',
        createdAt: '2026-10-19T10:00:00Z',
      },
    ],
  };

  it('renders order summary, ordered items, and Cancel button when in PLACED status', async () => {
    vi.spyOn(ordersApi, 'getOrderById').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_FETCHED',
      message: 'Order retrieved successfully',
      data: sampleOrder,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(<OrderDetailView orderId={10} />);

    await waitFor(() => {
      expect(screen.getByText(/ORD-000010/)).toBeDefined();
      expect(screen.getByText('Augmentin 625 Duo')).toBeDefined();
      expect(screen.getAllByText(/450\.00/).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Cancel Order/i })).toBeDefined();
    });
  });

  it('does NOT render Cancel button when order is already APPROVED', async () => {
    vi.spyOn(ordersApi, 'getOrderById').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_FETCHED',
      message: 'Order retrieved successfully',
      data: { ...sampleOrder, status: 'APPROVED' },
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(<OrderDetailView orderId={10} />);

    await waitFor(() => {
      expect(screen.getByText(/ORD-000010/)).toBeDefined();
      expect(screen.queryByRole('button', { name: /Cancel Order/i })).toBeNull();
    });
  });

  it('opens cancellation modal and successfully cancels order', async () => {
    vi.spyOn(ordersApi, 'getOrderById').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_FETCHED',
      message: 'Order retrieved successfully',
      data: sampleOrder,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    const cancelSpy = vi.spyOn(ordersApi, 'cancelOrder').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_CANCELLED',
      message: 'Order cancelled successfully',
      data: {
        orderId: 10,
        orderNumber: 'ORD-000010',
        status: 'CANCELLED',
        cancelledAt: '2026-10-19T11:00:00Z',
      },
      meta: { requestId: 'req_2', timestamp: '' },
    });

    render(<OrderDetailView orderId={10} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel Order/i })).toBeDefined();
    });

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Cancel Order/i }));
    expect(screen.getByText('Cancel Order ORD-000010?')).toBeDefined();

    // Confirm cancellation
    const confirmBtn = screen.getByRole('button', { name: /Confirm Cancellation/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(10, null);
      expect(screen.getByText('CANCELLED')).toBeDefined();
    });
  });
});
