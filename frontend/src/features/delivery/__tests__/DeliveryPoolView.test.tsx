import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeliveryPoolView } from '../DeliveryPoolView';
import * as deliveryApi from '@/lib/api/delivery.api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
  }),
}));

describe('DeliveryPoolView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const samplePoolOrders: deliveryApi.PoolOrderRecord[] = [
    {
      orderId: 10,
      orderNumber: 'ORD-2026-00010',
      retailer: {
        userId: 'ret-1',
        shopName: 'Apollo Medicos',
        pharmacyName: 'Apollo Medicos Pvt Ltd',
        city: 'Mumbai',
        pincode: '400001',
        phone: '9876543210',
      },
      itemCount: 3,
      totalAmount: '4500.00',
      approvedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
    },
    {
      orderId: 11,
      orderNumber: 'ORD-2026-00011',
      retailer: {
        userId: 'ret-2',
        shopName: 'Wellness Chemist',
        pharmacyName: 'Wellness Chemist',
        city: 'Thane',
        pincode: '400601',
        phone: '9876543211',
      },
      itemCount: 1,
      totalAmount: '850.00',
      approvedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    },
  ];

  it('renders pool order cards with shop name, city, amount, and item count', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryPool').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: samplePoolOrders,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DeliveryPoolView />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Apollo Medicos')).toBeInTheDocument();
    expect(screen.getByText('Wellness Chemist')).toBeInTheDocument();
    expect(screen.getByText('Mumbai — 400001')).toBeInTheDocument();
    expect(screen.getByText('Thane — 400601')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-00010')).toBeInTheDocument();
    expect(screen.getByText('4500.00')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('clicking "Claim Delivery" calls claim mutation and navigates on success', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryPool').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: [samplePoolOrders[0]],
      meta: { requestId: 'req_1', timestamp: '' },
    });

    const claimSpy = vi.spyOn(deliveryApi, 'claimDeliveryOrder').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: {
        orderId: 10,
        orderNumber: 'ORD-2026-00010',
        status: 'OUT_FOR_DELIVERY',
        note: null,
        claimedAt: new Date().toISOString(),
        deliveredAt: null,
        deliveryPhotoPath: null,
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        retailer: {
          userId: 'ret-1',
          shopName: 'Apollo Medicos',
          pharmacyName: 'Apollo Medicos Pvt Ltd',
          addressLine: '123 Marine Lines',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          whatsappNumber: '9876543210',
          phone: '9876543210',
        },
        deliveryPartner: { id: 'dp-1', username: 'rider1' },
        itemCount: 3,
        totalAmount: '4500.00',
        items: [],
      },
      meta: { requestId: 'req_2', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DeliveryPoolView />
      </QueryClientProvider>
    );

    const claimBtn = await screen.findByRole('button', { name: /Claim Delivery/i }, { timeout: 10000 });
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith(10);
      expect(mockPush).toHaveBeenCalledWith('/delivery/orders/10');
    });
  });

  it('displays "Already Taken" message when claim mutation returns 409 ORDER_ALREADY_CLAIMED', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryPool').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: [samplePoolOrders[0]],
      meta: { requestId: 'req_1', timestamp: '' },
    });

    vi.spyOn(deliveryApi, 'claimDeliveryOrder').mockRejectedValue({
      code: 'ORDER_ALREADY_CLAIMED',
      message: 'This order was already claimed by another delivery partner',
      status: 409,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DeliveryPoolView />
      </QueryClientProvider>
    );

    const claimBtn = await screen.findByRole('button', { name: /Claim Delivery/i });
    fireEvent.click(claimBtn);

    expect(
      await screen.findByText(/Another delivery partner claimed this order moments ago/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Order Already Claimed')).toBeInTheDocument();
  });
});
