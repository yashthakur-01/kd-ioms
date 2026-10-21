import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { OrdersListView } from '../OrdersListView';
import * as ordersApi from '../../../lib/api/orders.api';

// Mock useAuth
const mockUser = { id: 'admin-1', role: 'ADMIN', username: 'admin' };
vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

describe('OrdersListView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleOrders: ordersApi.OrderListItem[] = [
    {
      orderId: 10,
      orderNumber: 'ORD-000010',
      status: 'PLACED',
      createdAt: '2026-10-19T10:00:00Z',
      totalAmount: '450.00',
      itemCount: 1,
      retailer: {
        id: 'ret-1',
        username: 'apollo',
        pharmacyName: 'Apollo Pharmacy',
      },
    },
    {
      orderId: 11,
      orderNumber: 'ORD-000011',
      status: 'APPROVED',
      createdAt: '2026-10-19T11:00:00Z',
      totalAmount: '1200.00',
      itemCount: 3,
      retailer: {
        id: 'ret-2',
        username: 'medplus',
        pharmacyName: 'MedPlus Pharmacy',
      },
    },
  ];

  it('renders orders queue and does not display Pick & Approve button directly in queue table', async () => {
    vi.spyOn(ordersApi, 'getOrders').mockResolvedValue({
      success: true,
      data: sampleOrders,
      meta: {
        pagination: {
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalItems: 2,
        },
      },
    } as any);

    render(<OrdersListView />);

    await waitFor(() => {
      expect(screen.getByText('ORD-000010')).toBeDefined();
    });

    expect(screen.getByText('ORD-000011')).toBeDefined();

    // Verify "Pick & Approve" button is not present in the orders queue table
    expect(screen.queryByText(/Pick & Approve/i)).toBeNull();

    // Verify "View" links are present for navigation to OrderDetailView
    const viewLinks = screen.getAllByRole('link', { name: /View/i });
    expect(viewLinks.length).toBe(2);
    expect(viewLinks[0].getAttribute('href')).toBe('/orders/10');
    expect(viewLinks[1].getAttribute('href')).toBe('/orders/11');
  });
});
