import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UsersPage from '../../../app/(admin)/users/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../providers/AuthProvider';
import { ToastProvider } from '../../../providers/ToastProvider';
import * as usersApi from '../api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/users',
}));

describe('Admin UsersPage Component', () => {
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
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders user directory table with header and create button', () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      success: true,
      code: 'USERS_LISTED',
      message: 'Users listed',
      data: [
        {
          id: 'user-1',
          username: 'apollopharmacy',
          role: 'RETAILER',
          phone: '9876543210',
          isActive: true,
          mustChangePassword: false,
          createdAt: new Date().toISOString(),
        },
      ],
      meta: {
        requestId: 'req_123',
        timestamp: new Date().toISOString(),
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });

    renderWithProviders(<UsersPage />);

    expect(screen.getByRole('heading', { name: /user management/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\+ create new user/i })).toBeDefined();
    expect(screen.getByPlaceholderText(/search by username or phone/i)).toBeDefined();
  });

  it('updates search query input on user typing', () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      success: true,
      code: 'USERS_LISTED',
      message: 'Users listed',
      data: [],
      meta: {
        requestId: 'req_123',
        timestamp: new Date().toISOString(),
      },
    });

    renderWithProviders(<UsersPage />);

    const searchInput = screen.getByPlaceholderText(/search by username or phone/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'apollo' } });

    expect(searchInput.value).toBe('apollo');
  });
});
