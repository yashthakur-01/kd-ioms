import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Mock dependencies
const mockLogout = vi.fn();
vi.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { username: 'admin', role: 'ADMIN' },
    logout: mockLogout,
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('../../../features/alerts/hooks', () => ({
  useAlertsBadgeCount: () => ({
    data: 5,
  }),
}));

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders expanded by default with brand, all nav items, and user profile', () => {
    render(<Sidebar />);

    // Brand
    expect(screen.getByText('KD-IOMS')).toBeDefined();
    expect(screen.getByText('Wholesale Admin')).toBeDefined();

    // Nav items
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Retailers')).toBeDefined();
    expect(screen.getByText('Salts Master')).toBeDefined();
    expect(screen.getByText('Medicines')).toBeDefined();
    expect(screen.getByText('Stock Inward')).toBeDefined();
    expect(screen.getByText('Batches')).toBeDefined();
    expect(screen.getByText('Orders Queue')).toBeDefined();
    expect(screen.getByText('Tax Invoices')).toBeDefined();
    expect(screen.getByText('Alerts')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    // Alert badge count
    expect(screen.getByText('5')).toBeDefined();

    // User profile & Sign Out
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeDefined();

    // Aside container has expanded class
    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    expect(aside.className).toContain('w-64');
  });

  it('collapses sidebar when collapse button is clicked and stores preference in localStorage', () => {
    render(<Sidebar />);

    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);

    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    expect(aside.className).toContain('w-16');
    expect(localStorage.getItem('kd_sidebar_collapsed')).toBe('true');

    // Expand button is now visible
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeDefined();

    // Text labels should no longer be rendered in collapsed view
    expect(screen.queryByText('Wholesale Admin')).toBeNull();
  });

  it('expands sidebar when expand button is clicked', () => {
    localStorage.setItem('kd_sidebar_collapsed', 'true');
    render(<Sidebar />);

    // Starts collapsed due to localStorage
    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    expect(aside.className).toContain('w-16');

    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    fireEvent.click(expandBtn);

    expect(aside.className).toContain('w-64');
    expect(localStorage.getItem('kd_sidebar_collapsed')).toBe('false');
    expect(screen.getByText('KD-IOMS')).toBeDefined();
  });

  it('calls logout when Sign Out button is clicked', () => {
    render(<Sidebar />);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
