import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DoorstepChecklistView } from '../DoorstepChecklistView';
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

describe('DoorstepChecklistView Component', () => {
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

    // Mock window.URL.createObjectURL and revokeObjectURL
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }
  });

  const sampleDeliveryDetail: deliveryApi.DeliveryDetailRecord = {
    orderId: 42,
    orderNumber: 'ORD-2026-00042',
    status: 'OUT_FOR_DELIVERY',
    note: 'Ring buzzer at rear counter',
    claimedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    deliveredAt: null,
    deliveryPhotoPath: null,
    rejectionReason: null,
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    retailer: {
      userId: 'user-ret-42',
      shopName: 'Shree Krishna Medicals',
      pharmacyName: 'Shree Krishna Medicals',
      addressLine: 'Shop 4, Market Road, Dadar West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400028',
      whatsappNumber: '919876543210',
      phone: '9876543210',
    },
    deliveryPartner: {
      id: 'dp-user-1',
      username: 'fast_rider',
    },
    itemCount: 2,
    totalAmount: '2400.00',
    items: [
      {
        orderItemId: 101,
        medicineId: 1,
        medicineName: 'Paracetamol 650mg',
        company: 'Dolo Labs',
        packSize: '15 Tablets',
        requestedQuantity: 10,
        pickedQuantity: 10,
        quotedPriceInclGst: '120.00',
        deliveryStatus: 'PENDING',
        refusalReason: null,
        allocations: [
          {
            allocationId: 1,
            batchId: 50,
            batchNumber: 'DOLO-B22',
            expiryDate: '2028-05-31',
            quantity: 10,
            rate: '107.14',
            mrp: '150.00',
            gstRate: '12.00',
          },
        ],
      },
      {
        orderItemId: 102,
        medicineId: 2,
        medicineName: 'Azithromycin 500mg',
        company: 'Zithro Pharma',
        packSize: '3 Tablets',
        requestedQuantity: 5,
        pickedQuantity: 5,
        quotedPriceInclGst: '240.00',
        deliveryStatus: 'PENDING',
        refusalReason: null,
        allocations: [
          {
            allocationId: 2,
            batchId: 51,
            batchNumber: 'AZI-B99',
            expiryDate: '2027-11-30',
            quantity: 5,
            rate: '214.28',
            mrp: '300.00',
            gstRate: '12.00',
          },
        ],
      },
    ],
  };

  it('renders pharmacy address, tap-to-call link, and line items with allocated batch numbers', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryOrderDetail').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: sampleDeliveryDetail,
      meta: { requestId: 'req_1', timestamp: '' },
    });

  render(
      <QueryClientProvider client={queryClient}>
        <DoorstepChecklistView orderId={42} />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Shree Krishna Medicals')).toBeInTheDocument();
    expect(screen.getByText(/Shop 4, Market Road, Dadar West/i)).toBeInTheDocument();

    const callLink = screen.getByRole('link', { name: /Call \(9876543210\)/i });
    expect(callLink).toHaveAttribute('href', 'tel:9876543210');

    expect(screen.getByText('Paracetamol 650mg')).toBeInTheDocument();
    expect(screen.getByText(/DOLO-B22/i)).toBeInTheDocument();
    expect(screen.getByText('Azithromycin 500mg')).toBeInTheDocument();
    expect(screen.getByText(/AZI-B99/i)).toBeInTheDocument();
  });

  it('marking an item Refused requires a reason before submission can be enabled', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryOrderDetail').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: sampleDeliveryDetail,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DoorstepChecklistView orderId={42} />
      </QueryClientProvider>
    );

    await screen.findByText('Shree Krishna Medicals');

    // Accept item 1
    const acceptBtns = screen.getAllByRole('button', { name: /Accept Full/i });
    fireEvent.click(acceptBtns[0]);

    // Refuse item 2
    const refuseBtns = screen.getAllByRole('button', { name: /Refuse Full/i });
    fireEvent.click(refuseBtns[1]);

    // Submit button should be disabled initially
    const submitBtn = screen.getByRole('button', { name: /Complete Delivery/i });
    expect(submitBtn).toBeDisabled();

    // Now select a preset reason for item 2
    const presetBtn = screen.getByRole('button', { name: /Packaging torn \/ seal broken/i });
    fireEvent.click(presetBtn);

    // Still disabled because photo is not attached yet
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Delivery photo proof required/i)).toBeInTheDocument();
  });

  it('attaching photo proof and deciding all lines enables submission and executes completeDeliveryOrder', async () => {
    vi.spyOn(deliveryApi, 'fetchDeliveryOrderDetail').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: sampleDeliveryDetail,
      meta: { requestId: 'req_1', timestamp: '' },
    });

    const completeSpy = vi.spyOn(deliveryApi, 'completeDeliveryOrder').mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'Success',
      data: {
        ...sampleDeliveryDetail,
        status: 'DELIVERED',
        deliveredAt: new Date().toISOString(),
        deliveryPhotoPath: 'https://example.com/storage/photo.jpg',
      },
      meta: { requestId: 'req_2', timestamp: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DoorstepChecklistView orderId={42} />
      </QueryClientProvider>
    );

    await screen.findByText('Shree Krishna Medicals');

    // Accept both items
    const acceptBtns = screen.getAllByRole('button', { name: /Accept Full/i });
    fireEvent.click(acceptBtns[0]);
    fireEvent.click(acceptBtns[1]);

    // Attach mock photo file
    const file = new File(['mock content'], 'doorstep.jpg', { type: 'image/jpeg' });
    const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(hiddenFileInput).toBeDefined();

    fireEvent.change(hiddenFileInput, { target: { files: [file] } });

    // Submit button should now be enabled
    const submitBtn = await screen.findByRole('button', { name: /Complete Delivery/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(42, {
        photo: file,
        decisions: [
          { orderItemId: 101, decision: 'ACCEPTED', reason: undefined },
          { orderItemId: 102, decision: 'ACCEPTED', reason: undefined },
        ],
      });
    });
  });
});
