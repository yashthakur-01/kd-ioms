import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RetailerProfilePage from '../../../app/(retailer)/profile/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../providers/ToastProvider';
import * as retailerApi from '../api';
import type { RetailerProfile } from '../schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/profile',
}));

const mockLogout = vi.fn();

vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-ret-001',
      username: 'shreekrishna',
      role: 'RETAILER',
      phone: '+919876543210',
    },
    logout: mockLogout,
    isLoading: false,
  }),
}));

describe('RetailerProfilePage Component', () => {
  let queryClient: QueryClient;

  const mockApprovedProfile: RetailerProfile = {
    id: 'prof-123',
    userId: 'user-123',
    shopName: 'Shree Krishna Medical Stores',
    addressLine: '123 Station Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    whatsappNumber: '+919876543210',
    email: 'krishna@example.com',
    drugLicenseNumber: 'GJ-AH1-123456',
    gstin: '24AAAAA0000A1Z5',
    approvalStatus: 'APPROVED',
    rejectionReason: null,
    reviewedBy: 'admin-1',
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogout.mockClear();
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

  it('renders unsubmitted state with empty form and submit button', async () => {
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: null,
      approvalStatus: null,
    });

    renderWithProviders(<RetailerProfilePage />);

    expect(await screen.findByRole('heading', { name: /retailer kyc profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /submit profile for verification/i })).toBeDefined();
    expect(screen.getByPlaceholderText(/shree krishna medical stores/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/gj-ah1-123456/i)).toBeDefined();
  });

  it('renders pending state with amber banner, check status button, and read-only details', async () => {
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: { ...mockApprovedProfile, approvalStatus: 'PENDING' },
      approvalStatus: 'PENDING',
    });

    renderWithProviders(<RetailerProfilePage />);

    expect(await screen.findByTestId('pending-banner')).toBeDefined();
    expect(screen.getByText(/application under review/i)).toBeDefined();
    const checkBtn = screen.getByRole('button', { name: /check verification status/i });
    expect(checkBtn).toBeDefined();

    // Inspector details
    expect(screen.getByText('GJ-AH1-123456')).toBeDefined();
    expect(screen.getByText('24AAAAA0000A1Z5')).toBeDefined();

    // Trigger status check button
    fireEvent.click(checkBtn);
    expect(retailerApi.fetchMyProfile).toHaveBeenCalledTimes(2);
  });

  it('renders rejected state with red alert card containing admin remarks and pre-filled form', async () => {
    const rejectionReason = 'Uploaded drug license has expired. Please provide current license copy.';
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: {
        ...mockApprovedProfile,
        approvalStatus: 'REJECTED',
        rejectionReason,
      },
      approvalStatus: 'REJECTED',
    });

    renderWithProviders(<RetailerProfilePage />);

    expect(await screen.findByTestId('rejected-banner')).toBeDefined();
    expect(screen.getByText(/application needs attention/i)).toBeDefined();
    expect(screen.getByText(rejectionReason)).toBeDefined();

    // Pre-filled form
    const shopInput = screen.getByDisplayValue('Shree Krishna Medical Stores') as HTMLInputElement;
    expect(shopInput).toBeDefined();
    const resubmitBtn = screen.getByRole('button', { name: /resubmit for review/i });
    expect(resubmitBtn).toBeDefined();
  });

  it('renders approved state with emerald verified banner, browse catalog CTA, and lock notice', async () => {
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: mockApprovedProfile,
      approvalStatus: 'APPROVED',
    });

    renderWithProviders(<RetailerProfilePage />);

    expect(await screen.findByTestId('approved-banner')).toBeDefined();
    expect(screen.getByText(/account verified/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /browse catalog & order/i })).toBeDefined();
    expect(screen.getByText(/verified profile lock/i)).toBeDefined();
    expect(screen.getByText('GJ-AH1-123456')).toBeDefined();
  });

  it('renders retailer account details card with username, role, phone, and shop name', async () => {
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: mockApprovedProfile,
      approvalStatus: 'APPROVED',
    });

    renderWithProviders(<RetailerProfilePage />);

    expect(await screen.findByTestId('retailer-account-card')).toBeDefined();
    expect(screen.getByText('@shreekrishna')).toBeDefined();
    expect(screen.getAllByText('Shree Krishna Medical Stores').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+919876543210').length).toBeGreaterThan(0);
    expect(screen.getByText('Enabled (Full Access)')).toBeDefined();
  });

  it('renders sign out button and triggers logout on click', async () => {
    vi.spyOn(retailerApi, 'fetchMyProfile').mockResolvedValue({
      profile: mockApprovedProfile,
      approvalStatus: 'APPROVED',
    });

    renderWithProviders(<RetailerProfilePage />);

    const logoutBtn = await screen.findByTestId('retailer-logout-btn');
    expect(logoutBtn).toBeDefined();
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
