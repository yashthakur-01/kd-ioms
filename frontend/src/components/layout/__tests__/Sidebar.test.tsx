import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });

    // Brand in desktop sidebar
    expect(within(aside).getByText('KD-IOMS')).toBeDefined();
    expect(within(aside).getByText('Wholesale Admin')).toBeDefined();

    // Nav items
    expect(within(aside).getByText('Dashboard')).toBeDefined();
    expect(within(aside).getByText('Users')).toBeDefined();
    expect(within(aside).getByText('Retailers')).toBeDefined();
    expect(within(aside).getByText('Salts Master')).toBeDefined();
    expect(within(aside).getByText('Medicines')).toBeDefined();
    expect(within(aside).getByText('Stock Inward')).toBeDefined();
    expect(within(aside).getByText('Batches')).toBeDefined();
    expect(within(aside).getByText('Orders Queue')).toBeDefined();
    expect(within(aside).getByText('Tax Invoices')).toBeDefined();
    expect(within(aside).getByText('Alerts')).toBeDefined();
    expect(within(aside).getByText('Settings')).toBeDefined();

    // Alert badge count
    expect(within(aside).getByText('5')).toBeDefined();

    // User profile & Sign Out
    expect(within(aside).getAllByText('admin').length).toBeGreaterThanOrEqual(1);
    expect(within(aside).getByRole('button', { name: /sign out/i })).toBeDefined();

    // Aside container has expanded class
    expect(aside.className).toContain('w-64');
  });

  it('collapses sidebar when collapse button is clicked and stores preference in localStorage', () => {
    render(<Sidebar />);

    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    const collapseBtn = within(aside).getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);

    expect(aside.className).toContain('w-16');
    expect(localStorage.getItem('kd_sidebar_collapsed')).toBe('true');

    // Expand button is now visible
    const expandBtn = within(aside).getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeDefined();

    // Text labels should no longer be rendered in collapsed view in desktop sidebar
    expect(within(aside).queryByText('Wholesale Admin')).toBeNull();
  });

  it('expands sidebar when expand button is clicked', () => {
    localStorage.setItem('kd_sidebar_collapsed', 'true');
    render(<Sidebar />);

    // Starts collapsed due to localStorage
    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    expect(aside.className).toContain('w-16');

    const expandBtn = within(aside).getByRole('button', { name: /expand sidebar/i });
    fireEvent.click(expandBtn);

    expect(aside.className).toContain('w-64');
    expect(localStorage.getItem('kd_sidebar_collapsed')).toBe('false');
    expect(within(aside).getByText('KD-IOMS')).toBeDefined();
  });

  it('calls logout when Sign Out button is clicked', () => {
    render(<Sidebar />);

    const aside = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    const signOutBtn = within(aside).getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
