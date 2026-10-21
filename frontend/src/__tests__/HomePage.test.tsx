import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../app/page';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

const mockAuth = {
  user: null as any,
  isLoading: false,
};

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

describe('Home Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockAuth.isLoading = false;
  });

  it('renders branding and Sign In button, but does not render Admin or Retailer shortcut buttons', () => {
    render(<Home />);

    expect(screen.getByText('Kandarp Drugs')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();

    // Verify Admin and Retailer buttons are removed
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retailer' })).toBeNull();
  });

  it('redirects authenticated ADMIN to /dashboard', () => {
    mockAuth.user = { id: 'admin-1', role: 'ADMIN', username: 'admin' };
    render(<Home />);

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects authenticated RETAILER to /catalog', () => {
    mockAuth.user = { id: 'ret-1', role: 'RETAILER', username: 'apollo' };
    render(<Home />);

    expect(mockReplace).toHaveBeenCalledWith('/catalog');
  });

  it('redirects authenticated DELIVERY to /delivery/orders', () => {
    mockAuth.user = { id: 'dp-1', role: 'DELIVERY', username: 'amit' };
    render(<Home />);

    expect(mockReplace).toHaveBeenCalledWith('/delivery/orders');
  });
});
