import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminRetailersPage from '../../../app/(admin)/retailers/page';
import AdminRetailerDetailPage from '../../../app/(admin)/retailers/[userId]/page';
import { RejectionModal } from '../components/RejectionModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../providers/ToastProvider';
import * as retailerApi from '../api';
import type { RetailerRecord } from '../schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/retailers',
  useParams: () => ({
    userId: 'target-user-123',
  }),
}));

describe('Admin Retailer Review Module', () => {
  let queryClient: QueryClient;

  const sampleRetailer: RetailerRecord = {
    id: 'prof-1',
    userId: 'target-user-123',
    shopName: 'Shree Krishna Medical Stores',
    addressLine: '123 Station Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    whatsappNumber: '+919876543210',
    email: 'krishna@example.com',
    drugLicenseNumber: 'GJ-AH1-123456',
    gstin: '24AAAAA0000A1Z5',
    approvalStatus: 'PENDING',
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    username: 'chemist123',
    userPhone: '9876543210',
    userIsActive: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    );
  };

  describe('AdminRetailersPage Queue', () => {
    it('renders queue tabs with pending badge and table rows', async () => {
      vi.spyOn(retailerApi, 'fetchRetailers').mockResolvedValue({
        success: true,
        code: 'RETAILERS_LISTED',
        message: 'Retailers listed',
        data: [sampleRetailer],
        meta: {
          requestId: 'req_1',
          timestamp: new Date().toISOString(),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        },
      });

      renderWithProviders(<AdminRetailersPage />);

      expect(await screen.findByRole('heading', { name: /retailer management/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /pending review/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /approved/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /rejected/i })).toBeDefined();
      expect(await screen.findByText('Shree Krishna Medical Stores')).toBeDefined();
      expect(screen.getByText('GJ-AH1-123456')).toBeDefined();
    });

    it('updates search query input on user typing', async () => {
      vi.spyOn(retailerApi, 'fetchRetailers').mockResolvedValue({
        success: true,
        code: 'RETAILERS_LISTED',
        message: 'Retailers listed',
        data: [],
        meta: {
          requestId: 'req_1',
          timestamp: new Date().toISOString(),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 1,
          },
        },
      });

      renderWithProviders(<AdminRetailersPage />);

      const searchInput = (await screen.findByPlaceholderText(
        /search by shop name, license, or phone/i
      )) as HTMLInputElement;

      fireEvent.change(searchInput, { target: { value: 'Krishna' } });
      expect(searchInput.value).toBe('Krishna');
    });
  });

  describe('AdminRetailerDetailPage Inspection & Actions', () => {
    it('renders retailer details with approve and reject buttons', async () => {
      vi.spyOn(retailerApi, 'fetchRetailerById').mockResolvedValue(sampleRetailer);

      renderWithProviders(<AdminRetailerDetailPage />);

      expect(await screen.findByRole('heading', { name: 'Shree Krishna Medical Stores' })).toBeDefined();
      expect(screen.getByText('GJ-AH1-123456')).toBeDefined();
      expect(screen.getByText('24AAAAA0000A1Z5')).toBeDefined();
      expect(screen.getByRole('button', { name: /approve application/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /reject application/i })).toBeDefined();
    });

    it('opens ConfirmDialog on approve button click with shop summary', async () => {
      vi.spyOn(retailerApi, 'fetchRetailerById').mockResolvedValue(sampleRetailer);
      vi.spyOn(retailerApi, 'approveRetailer').mockResolvedValue({
        ...sampleRetailer,
        approvalStatus: 'APPROVED',
      });

      renderWithProviders(<AdminRetailerDetailPage />);

      const approveBtn = await screen.findByRole('button', { name: /approve application/i });
      fireEvent.click(approveBtn);

      expect(await screen.findByText(/confirm approval for shree krishna medical stores/i)).toBeDefined();

      const confirmBtn = screen.getByRole('button', { name: /confirm approval/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(retailerApi.approveRetailer).toHaveBeenCalledWith('target-user-123');
      });
    });

    it('opens RejectionModal on reject button click and submits with preset chip', async () => {
      vi.spyOn(retailerApi, 'fetchRetailerById').mockResolvedValue(sampleRetailer);
      vi.spyOn(retailerApi, 'rejectRetailer').mockResolvedValue({
        ...sampleRetailer,
        approvalStatus: 'REJECTED',
        rejectionReason: 'Invalid Drug License format',
      });

      renderWithProviders(<AdminRetailerDetailPage />);

      const rejectBtn = await screen.findByRole('button', { name: /reject application/i });
      fireEvent.click(rejectBtn);

      expect(await screen.findByText(/quick-select compliance reasons/i)).toBeDefined();

      // Click preset chip
      const chip = screen.getByText('+ Invalid Drug License format');
      fireEvent.click(chip);

      const confirmRejectBtn = screen.getByRole('button', { name: /confirm rejection/i });
      expect((confirmRejectBtn as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(confirmRejectBtn);

      await waitFor(() => {
        expect(retailerApi.rejectRetailer).toHaveBeenCalledWith(
          'target-user-123',
          'Invalid Drug License format'
        );
      });
    });
  });

  describe('RejectionModal Component', () => {
    it('enforces 5-300 character limit on confirm button', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();

      render(
        <RejectionModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          shopName="Test Shop"
        />
      );

      const confirmBtn = screen.getByRole('button', { name: /confirm rejection/i }) as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);

      const textarea = screen.getByPlaceholderText(/explain the specific discrepancy/i);
      fireEvent.change(textarea, { target: { value: 'abc' } }); // < 5 chars
      expect(confirmBtn.disabled).toBe(true);

      fireEvent.change(textarea, { target: { value: 'Valid rejection rationale' } }); // >= 5 chars
      expect(confirmBtn.disabled).toBe(false);

      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledWith('Valid rejection rationale');
    });
  });
});
