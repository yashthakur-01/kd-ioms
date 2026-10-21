import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeliveryLayout from '@/app/(delivery)/layout';

const mockLogout = vi.fn();
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { username: 'delivery_partner_1', role: 'DELIVERY' },
    logout: mockLogout,
    isLoading: false,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/delivery/orders',
}));

describe('DeliveryLayout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders branding, delivery routes, and user profile', () => {
    render(
      <DeliveryLayout>
        <div>Delivery Dashboard Content</div>
      </DeliveryLayout>
    );

    expect(screen.getByText('Kandarp Drugs')).toBeDefined();
    expect(screen.getByText('Delivery Partner')).toBeDefined();
    expect(screen.getByText('Delivery Dashboard Content')).toBeDefined();

    // Check all routes are visible in navigation
    expect(screen.getAllByText('Dispatch Pool').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active Deliveries').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delivery History').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Place Order').length).toBeGreaterThan(0);
  });

  it('renders Sign Out button and invokes logout on click', () => {
    render(
      <DeliveryLayout>
        <div>Content</div>
      </DeliveryLayout>
    );

    const signoutBtn = screen.getByTestId('delivery-signout-btn');
    expect(signoutBtn).toBeDefined();

    fireEvent.click(signoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
