import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CartCheckoutView } from '../CartCheckoutView';
import * as ordersApi from '../../../lib/api/orders.api';
import { ApiError } from '../../../lib/api/api-error';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => '/cart',
}));

// Mock useAuth
vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'retailer-1', role: 'RETAILER', username: 'apollo' },
    isAuthenticated: true,
  }),
}));

describe('CartCheckoutView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders empty cart state with CTA to browse catalog when cart has no items', () => {
    render(<CartCheckoutView />);

    expect(screen.getByText('Your Cart is Empty')).toBeDefined();
    expect(screen.getByText(/Looks like you haven't added any medicines yet/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Browse Medicine Catalog/i })).toBeDefined();
  });

  it('renders cart items with quantity, unit prices, line totals, and grand total', () => {
    // Populate localStorage cart
    window.localStorage.setItem(
      'kd_cart_retailer-1',
      JSON.stringify([
        {
          medicineId: 10,
          name: 'Augmentin 625 Duo',
          company: 'GSK',
          packSize: '10 Tablets',
          priceInclGst: '201.15',
          mrp: '223.50',
          gstRate: '12.00',
          quantity: 2,
          maxAvailable: 50,
        },
      ])
    );

    render(<CartCheckoutView />);

    expect(screen.getByText('Augmentin 625 Duo')).toBeDefined();
    expect(screen.getByText('GSK')).toBeDefined();
    expect(screen.getByText('₹201.15')).toBeDefined();
    expect(screen.getByText('MRP ₹223.50')).toBeDefined();
    const totals = screen.getAllByText(/402\.30/);
    expect(totals.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Place Order/i })).toBeDefined();
  });

  it('updates line total and grand total when stepper is clicked', () => {
    window.localStorage.setItem(
      'kd_cart_retailer-1',
      JSON.stringify([
        {
          medicineId: 10,
          name: 'Augmentin 625 Duo',
          company: 'GSK',
          packSize: '10 Tablets',
          priceInclGst: '100.00',
          mrp: '120.00',
          gstRate: '12.00',
          quantity: 1,
          maxAvailable: 50,
        },
      ])
    );

    render(<CartCheckoutView />);

    const incrementBtn = screen.getByRole('button', { name: 'Increase quantity' });
    fireEvent.click(incrementBtn);

    const totals = screen.getAllByText(/200\.00/);
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  it('submits order and navigates to order page on success', async () => {
    window.localStorage.setItem(
      'kd_cart_retailer-1',
      JSON.stringify([
        {
          medicineId: 10,
          name: 'Augmentin 625 Duo',
          company: 'GSK',
          packSize: '10 Tablets',
          priceInclGst: '100.00',
          mrp: '120.00',
          gstRate: '12.00',
          quantity: 2,
          maxAvailable: 50,
        },
      ])
    );

    const placeOrderSpy = vi.spyOn(ordersApi, 'placeOrder').mockResolvedValueOnce({
      success: true,
      code: 'ORDER_PLACED',
      message: 'Order placed successfully',
      data: {
        orderId: 77,
        orderNumber: 'ORD-000077',
        status: 'PLACED',
        totalAmount: '200.00',
        retailerId: 'retailer-1',
        itemCount: 1,
        items: [],
        createdAt: '2026-10-19T10:00:00Z',
      },
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(<CartCheckoutView />);

    // Add note
    const noteInput = screen.getByLabelText(/Delivery Notes/i);
    fireEvent.change(noteInput, { target: { value: 'Urgent delivery' } });

    const submitBtn = screen.getByRole('button', { name: /Place Order/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(placeOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          note: 'Urgent delivery',
          items: [{ medicineId: 10, quantity: 2, quotedPriceInclGst: '100.00' }],
        }),
        expect.any(String)
      );
      expect(mockPush).toHaveBeenCalledWith('/orders/77');
    });

    // Verify cart is cleared
    expect(window.localStorage.getItem('kd_cart_retailer-1')).toBeNull();
  });

  it('displays shortage warning and updates quantity when Use Available is clicked on 409 INSUFFICIENT_STOCK', async () => {
    window.localStorage.setItem(
      'kd_cart_retailer-1',
      JSON.stringify([
        {
          medicineId: 10,
          name: 'Augmentin 625 Duo',
          company: 'GSK',
          packSize: '10 Tablets',
          priceInclGst: '100.00',
          mrp: '120.00',
          gstRate: '12.00',
          quantity: 10,
          maxAvailable: 50,
        },
      ])
    );

    const apiError = new ApiError({
      status: 409,
      code: 'INSUFFICIENT_STOCK',
      message: 'Insufficient stock for requested medicines',
      details: {
        items: [{ medicineId: 10, requested: 10, available: 4 }],
      },
    });

    vi.spyOn(ordersApi, 'placeOrder').mockRejectedValueOnce(apiError);

    render(<CartCheckoutView />);

    const submitBtn = screen.getByRole('button', { name: /Place Order/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Only 4 available/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Use 4/i })).toBeDefined();
    });

    // Click "Use 4"
    const useAvailableBtn = screen.getByRole('button', { name: /Use 4/i });
    fireEvent.click(useAvailableBtn);

    // Shortage alert should clear and quantity is updated to 4
    expect(screen.queryByText(/Only 4 available/i)).toBeNull();
    const updatedTotals = screen.getAllByText(/400\.00/);
    expect(updatedTotals.length).toBeGreaterThanOrEqual(1);
  });
});
