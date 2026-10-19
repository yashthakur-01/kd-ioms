import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminAlertsPage from '../page';
import * as client from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams('tab=near-expiry');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/alerts',
}));

describe('AdminAlertsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSearchParams = new URLSearchParams('tab=near-expiry');
  });

  it('renders page header and operational tab strip', () => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue({
      success: true,
      code: 'ALERTS_LISTED',
      message: 'OK',
      data: [],
      meta: {
        requestId: '1',
        timestamp: '',
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      },
    });

    renderWithClient(<AdminAlertsPage />);

    expect(screen.getByText('Inventory & Expiry Alerts')).toBeDefined();
    expect(screen.getByText('Out of Stock')).toBeDefined();
    expect(screen.getByText('Near Expiry')).toBeDefined();
    expect(screen.getByText('Expired Stock')).toBeDefined();
  });

  it('renders out-of-stock medicines table and direct inward action link', async () => {
    mockSearchParams = new URLSearchParams('tab=out-of-stock');
    vi.spyOn(client, 'apiFetch').mockResolvedValue({
      success: true,
      code: 'ALERTS_LISTED',
      message: 'OK',
      data: [
        {
          medicineId: 55,
          name: 'Amoxicillin 500mg',
          company: 'Abbott',
          packSize: '10 Capsules',
          saltsText: 'Amoxicillin (500mg)',
          gstRate: '12.00',
          onHandQty: 0,
          reservedQty: 0,
          availableQty: 0,
          maxMrp: '110.00',
        },
      ],
      meta: {
        requestId: '1',
        timestamp: '',
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
    });

    renderWithClient(<AdminAlertsPage />);

    expect(await screen.findByText('Amoxicillin 500mg')).toBeDefined();
    expect(screen.getByText('Abbott')).toBeDefined();
    expect(screen.getAllByText('Out of Stock').length).toBeGreaterThanOrEqual(1);
    const inwardLink = screen.getByRole('link', { name: /receive stock/i });
    expect(inwardLink.getAttribute('href')).toBe('/stock/inward?medicineId=55');
  });
});
