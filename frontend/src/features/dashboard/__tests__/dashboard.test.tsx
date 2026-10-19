import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSummaryCards } from '../components/DashboardSummaryCards';
import { QuickActions } from '../components/QuickActions';

describe('Dashboard Components', () => {
  const mockSummary = {
    pendingRetailers: 4,
    placedOrders: 12,
    approvedUnclaimed: 3,
    outForDelivery: 5,
    nearExpiryBatches: 6,
    expiredBatches: 2,
    outOfStockMedicines: 7,
    failedNotifications: 0,
  };

  it('renders all 8 operational KPI cards with figures', () => {
    render(<DashboardSummaryCards summary={mockSummary} isLoading={false} />);

    expect(screen.getByText('Pending Retailers')).toBeDefined();
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Placed Orders')).toBeDefined();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Near Expiry Batches')).toBeDefined();
    expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Expired Stock')).toBeDefined();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Out of Stock Medicines')).toBeDefined();
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
  });

  it('renders QuickActions shortcuts', () => {
    render(<QuickActions />);

    expect(screen.getByText('Receive Inward Stock')).toBeDefined();
    expect(screen.getByText('Review Retailer KYC')).toBeDefined();
    expect(screen.getByText('Manage Expiry Alerts')).toBeDefined();
    expect(screen.getByText('System & Invoicing Settings')).toBeDefined();
  });
});
