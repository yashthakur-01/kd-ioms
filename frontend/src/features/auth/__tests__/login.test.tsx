import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '../../../app/(auth)/login/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../providers/AuthProvider';
import { ToastProvider } from '../../../providers/ToastProvider';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  usePathname: () => '/login',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('../api', () => ({
  login: vi.fn(),
}));

describe('LoginPage Component', () => {
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

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders login form with username, password, and sign in button', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/^username/i)).toBeDefined();
    expect(screen.getByLabelText(/^password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('allows user input in username and password fields', () => {
    renderWithProviders(<LoginPage />);

    const usernameInput = screen.getByLabelText(/^username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });

    expect(usernameInput.value).toBe('admin');
    expect(passwordInput.value).toBe('Secret123!');
  });

  it('renders standard login form with back button and demo credentials card', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('link', { name: /back to home/i })).toBeDefined();
    expect(screen.getByText(/demo credentials/i)).toBeDefined();
    expect(screen.getByText('admin')).toBeDefined();
    expect(screen.getByText('Admin@KD2026!')).toBeDefined();
    expect(screen.getByText('apollo_pharmacy')).toBeDefined();
    expect(screen.getByText('Retailer@KD2026!')).toBeDefined();
    expect(screen.getByRole('button', { name: /copy and fill admin credentials/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /copy and fill retailer credentials/i })).toBeDefined();
  });

  it('fills admin credentials into form fields when admin auto-fill is clicked', () => {
    renderWithProviders(<LoginPage />);

    const fillAdminBtn = screen.getByRole('button', { name: /copy and fill admin credentials/i });
    fireEvent.click(fillAdminBtn);

    const usernameInput = screen.getByLabelText(/^username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;

    expect(usernameInput.value).toBe('admin');
    expect(passwordInput.value).toBe('Admin@KD2026!');
  });

  it('fills retailer credentials into form fields when retailer auto-fill is clicked', () => {
    renderWithProviders(<LoginPage />);

    const fillRetailerBtn = screen.getByRole('button', { name: /copy and fill retailer credentials/i });
    fireEvent.click(fillRetailerBtn);

    const usernameInput = screen.getByLabelText(/^username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;

    expect(usernameInput.value).toBe('apollo_pharmacy');
    expect(passwordInput.value).toBe('Retailer@KD2026!');
  });

  it('allows clicking individual copy buttons for username and password', () => {
    renderWithProviders(<LoginPage />);

    const copyAdminUserBtn = screen.getByRole('button', { name: /copy admin username/i });
    const copyAdminPassBtn = screen.getByRole('button', { name: /copy admin password/i });
    const copyRetUserBtn = screen.getByRole('button', { name: /copy retailer username/i });
    const copyRetPassBtn = screen.getByRole('button', { name: /copy retailer password/i });

    fireEvent.click(copyAdminUserBtn);
    fireEvent.click(copyAdminPassBtn);
    fireEvent.click(copyRetUserBtn);
    fireEvent.click(copyRetPassBtn);

    expect(copyAdminUserBtn).toBeDefined();
    expect(copyAdminPassBtn).toBeDefined();
    expect(copyRetUserBtn).toBeDefined();
    expect(copyRetPassBtn).toBeDefined();
  });

  it('redirects admin directly to /dashboard upon successful login even if callbackUrl was set to /catalog', async () => {
    mockSearchParams = new URLSearchParams('callbackUrl=/catalog');
    const authApi = await import('../api');
    vi.mocked(authApi.login).mockResolvedValueOnce({
      accessToken: 'fake-admin-token',
      expiresIn: 900,
      user: {
        id: 'admin-id',
        username: 'admin',
        role: 'ADMIN',
        mustChangePassword: false,
      },
    });

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Admin@KD2026!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});

