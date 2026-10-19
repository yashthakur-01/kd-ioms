import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsForm } from '../components/SettingsForm';
import * as hooks from '../hooks';
import type { ApiResponse } from '../../../lib/api/client';
import type { AppSettings } from '../types';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SettingsForm Component', () => {
  const mockSettings: ApiResponse<AppSettings> = {
    success: true,
    code: 'SETTINGS_FETCHED',
    message: 'Success',
    data: {
      expiryAlertDays: 45,
      businessProfile: {
        name: 'Kandarp Drugs Wholesale',
        address: '101 Pharma Plaza, Ahmedabad',
        gstin: '24AAAAA0000A1Z5',
        drugLicenseNumber: 'GJ-AHM-987654',
        phone: '+919876543210',
        email: 'info@kandarpdrugs.com',
        logoPath: null,
      },
    },
    meta: {
      requestId: 'test-req',
      timestamp: new Date().toISOString(),
    },
  };

  it('renders form inputs populated with settings data', () => {
    vi.spyOn(hooks, 'useSettings').mockReturnValue({
      data: mockSettings,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useSettings>);

    renderWithClient(<SettingsForm />);

    expect(screen.getByDisplayValue('45')).toBeDefined();
    expect(screen.getByDisplayValue('Kandarp Drugs Wholesale')).toBeDefined();
    expect(screen.getByDisplayValue('24AAAAA0000A1Z5')).toBeDefined();
    expect(screen.getByDisplayValue('+919876543210')).toBeDefined();
  });

  it('validates invalid GSTIN format on submit', async () => {
    vi.spyOn(hooks, 'useSettings').mockReturnValue({
      data: mockSettings,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useSettings>);

    renderWithClient(<SettingsForm />);

    const gstinInput = screen.getByDisplayValue('24AAAAA0000A1Z5');
    fireEvent.change(gstinInput, { target: { value: 'INVALID_GSTIN_123' } });

    const submitBtn = screen.getByText('Save System Settings');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid GSTIN format/)).toBeDefined();
    });
  });

  it('successfully fires mutation on valid submit', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.spyOn(hooks, 'useSettings').mockReturnValue({
      data: mockSettings,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useSettings>);
    vi.spyOn(hooks, 'useUpdateSettingsMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useUpdateSettingsMutation>);

    renderWithClient(<SettingsForm />);

    const daysInput = screen.getByDisplayValue('45');
    fireEvent.change(daysInput, { target: { value: '90' } });

    const submitBtn = screen.getByText('Save System Settings');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          expiryAlertDays: 90,
        })
      );
    });
  });
});
