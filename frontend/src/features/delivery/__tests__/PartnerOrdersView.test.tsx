import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerOrdersView } from '../PartnerOrdersView';
import * as deliveryApi from '@/lib/api/delivery.api';

vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
  }),
}));

describe('PartnerOrdersView Component', () => {
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

  const samplePartnerOrders: deliveryApi.PartnerOrderRecord[] = [
    {
      orderId: 21,
      orderNumber: 'ORD-2026-00021',
      status: 'OUT_FOR_DELIVERY',
      retailerShopName: 'MedPlus Chemist',
      city: 'Pune',
      itemCount: 4,
      totalAmount: '3200.00',
      claimedAt: new Date(Date.now() - 10 * 60000).toISOString(),
      deliveredAt: null,
      createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    },
    {
      orderId: 22,
      orderNumber: 'ORD-2026-00022',
      status: 'DELIVERED',
      retailerShopName: 'Noble Pharmacy',
      city: 'Mumbai',
      itemCount: 2,
      totalAmount: '1500.00',
      claimedAt: new Date(Date.now() - 180 * 60000).toISOString(),
      deliveredAt: new Date(Date.now() - 60 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
    },
    {
      orderId: 23,
      orderNumber: 'ORD-2026-00023',
      status: 'REJECTED',
      retailerShopName: 'Care Pharmacy',
      city: 'Nagpur',
      itemCount: 1,
      totalAmount: '500.00',
      claimedAt: new Date(Date.now() - 300 * 60000).toISOString(),
      deliveredAt: new Date(Date.now() - 120 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
    },
  ];

  it('displays active orders with "Start Doorstep Check" navigation link', async () => {
    vi.spyOn(deliveryApi, 'fetchPartnerDeliveries').mockResolvedValue({
      status: 200,
      data: samplePartnerOrders,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PartnerOrdersView />
      </QueryClientProvider>
    );

    expect(await screen.findByText('MedPlus Chemist')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-00021')).toBeInTheDocument();
    expect(screen.getByText('Pune')).toBeInTheDocument();
    expect(screen.getByText('Out For Delivery')).toBeInTheDocument();

    const checkLink = screen.getByRole('link', { name: /Start Doorstep Check/i });
    expect(checkLink).toHaveAttribute('href', '/delivery/orders/21');
  });

  it('switches between Active and Past delivery tabs', async () => {
    vi.spyOn(deliveryApi, 'fetchPartnerDeliveries').mockResolvedValue({
      status: 200,
      data: samplePartnerOrders,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PartnerOrdersView />
      </QueryClientProvider>
    );

    expect(await screen.findByText('MedPlus Chemist')).toBeInTheDocument();
    expect(screen.queryByText('Noble Pharmacy')).not.toBeInTheDocument();

    // Click Past Deliveries tab
    const pastTab = screen.getByRole('button', { name: /Past Deliveries/i });
    fireEvent.click(pastTab);

    expect(await screen.findByText('Noble Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Care Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Refused')).toBeInTheDocument();
    expect(screen.queryByText('MedPlus Chemist')).not.toBeInTheDocument();
  });

  it('opens release modal and executes release mutation', async () => {
    vi.spyOn(deliveryApi, 'fetchPartnerDeliveries').mockResolvedValue({
      status: 200,
      data: samplePartnerOrders,
    });

    const releaseSpy = vi.spyOn(deliveryApi, 'releaseDeliveryOrder').mockResolvedValue({
      status: 200,
      data: {
        orderId: 21,
        status: 'APPROVED',
        message: 'Order successfully released back to dispatch pool',
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PartnerOrdersView />
      </QueryClientProvider>
    );

    const releaseBtn = await screen.findByRole('button', { name: /Release/i });
    fireEvent.click(releaseBtn);

    expect(screen.getByText(/Return Order #ORD-2026-00021 to Dispatch Pool\?/i)).toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(/Vehicle breakdown/i);
    fireEvent.change(reasonInput, { target: { value: 'Flat tyre' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Release/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(releaseSpy).toHaveBeenCalledWith(21, 'Flat tyre');
    });
  });
});
