import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import * as authApi from '../api';

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'delivery_amit', role: 'DELIVERY' },
    setUser: vi.fn(),
  }),
}));

const mockAddToast = vi.fn();
vi.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

describe('ChangePasswordForm Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('renders password inputs and disables submit button initially', () => {
    renderWithProviders(<ChangePasswordForm />);

    expect(screen.getByLabelText(/^Current Password/i)).toBeDefined();
    expect(screen.getByLabelText(/^New Password/i)).toBeDefined();
    expect(screen.getByLabelText(/^Confirm New Password/i)).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit button when valid password rules are met and triggers mutation', async () => {
    const changePasswordSpy = vi.spyOn(authApi, 'changePassword').mockResolvedValue({
      accessToken: 'mock-access-token-new',
      expiresIn: 900,
    });

    const mockSuccess = vi.fn();

    renderWithProviders(<ChangePasswordForm onSuccess={mockSuccess} cancelHref="/delivery/orders" />);

    const currentInput = screen.getByLabelText(/^Current Password/i);
    const newInput = screen.getByLabelText(/^New Password/i);
    const confirmInput = screen.getByLabelText(/^Confirm New Password/i);

    fireEvent.change(currentInput, { target: { value: 'OldPassword123!' } });
    fireEvent.change(newInput, { target: { value: 'NewSecurePassword2026!' } });
    fireEvent.change(confirmInput, { target: { value: 'NewSecurePassword2026!' } });

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changePasswordSpy).toHaveBeenCalledWith({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword2026!',
      });
      expect(mockSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
