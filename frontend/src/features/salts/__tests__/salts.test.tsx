import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SaltsMasterPage from '../../../app/(admin)/salts/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../providers/ToastProvider';
import * as saltsApi from '../api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/salts',
}));

describe('Admin Salts Master Feature', () => {
  let queryClient: QueryClient;

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

  it('renders salts table with items and open Add Salt modal', async () => {
    vi.spyOn(saltsApi, 'fetchSalts').mockResolvedValue({
      success: true,
      code: 'SALTS_LISTED',
      message: 'Salts listed',
      data: [
        {
          saltId: 1,
          saltName: 'Amoxicillin',
          isActive: true,
          medicineCount: 4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        requestId: 'req_1',
        timestamp: new Date().toISOString(),
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
    });

    renderWithProviders(<SaltsMasterPage />);

    expect(await screen.findByText('Amoxicillin')).toBeTruthy();
    expect(screen.getByText('4 medicines')).toBeTruthy();

    const addBtn = screen.getByRole('button', { name: /\+ Add Salt/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: /Add New Salt/i })).toBeTruthy();
  });

  it('shows near-match collision warning in AddSaltModal when suggestions exist', async () => {
    vi.spyOn(saltsApi, 'fetchSalts').mockResolvedValue({
      success: true,
      code: 'SALTS_LISTED',
      message: 'Salts listed',
      data: [],
      meta: {
        requestId: 'req_2',
        timestamp: new Date().toISOString(),
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      },
    });

    vi.spyOn(saltsApi, 'fetchSaltSuggestions').mockResolvedValue([
      {
        saltId: 10,
        saltName: 'Paracetamol',
        similarity: 0.78,
        isActive: true,
      },
    ]);

    renderWithProviders(<SaltsMasterPage />);

    const addBtn = await screen.findByRole('button', { name: /\+ Add Salt/i });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText(/e.g. Paracetamol/i);
    fireEvent.change(input, { target: { value: 'Paracetamol 500' } });

    // Warning banner should appear with match details
    expect(await screen.findByText(/Similar salts already exist/i)).toBeTruthy();
    expect(screen.getByText(/Paracetamol \(78% match\)/i)).toBeTruthy();

    // Submit button should be disabled until checkbox confirmed
    const submitBtn = screen.getByRole('button', { name: /^Create Salt$/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Check confirm checkbox
    const confirmCheckbox = screen.getByLabelText(/Confirm this is a distinct new salt formula/i) as HTMLInputElement;
    fireEvent.click(confirmCheckbox);

    expect(submitBtn.disabled).toBe(false);
  });
});
