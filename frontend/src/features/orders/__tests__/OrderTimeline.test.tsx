import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { OrderTimeline } from '../OrderTimeline';

describe('OrderTimeline Component', () => {
  it('renders linear progression milestones for PLACED order', () => {
    render(<OrderTimeline currentStatus="PLACED" history={[]} />);

    expect(screen.getByText('Order Lifecycle Status')).toBeDefined();
    expect(screen.getByText('Order Placed')).toBeDefined();
    expect(screen.getByText('Approved & Packed')).toBeDefined();
    expect(screen.getByText('Out for Delivery')).toBeDefined();
    expect(screen.getByText('Delivered')).toBeDefined();
  });

  it('renders timestamps and notes from history', () => {
    const sampleHistory = [
      {
        historyId: 1,
        fromStatus: null,
        toStatus: 'PLACED' as const,
        actorName: 'Apollo Pharmacy',
        note: 'Order placed by retailer',
        createdAt: '2026-10-19T10:00:00Z',
      },
    ];

    render(<OrderTimeline currentStatus="PLACED" history={sampleHistory} />);

    expect(screen.getByText('Order placed by retailer')).toBeDefined();
  });

  it('renders terminal Cancelled branch with timestamp and reason when CANCELLED', () => {
    render(
      <OrderTimeline
        currentStatus="CANCELLED"
        cancelledAt="2026-10-19T14:30:00Z"
        rejectionReason="Customer cancelled before dispatch"
      />
    );

    expect(screen.getByText('Order Cancelled')).toBeDefined();
    expect(screen.getByText('Customer cancelled before dispatch')).toBeDefined();
    // Linear steps after placed are omitted
    expect(screen.queryByText('Approved & Packed')).toBeNull();
  });

  it('renders terminal Rejected branch when REJECTED', () => {
    render(
      <OrderTimeline
        currentStatus="REJECTED"
        rejectionReason="Damaged goods in warehouse"
      />
    );

    expect(screen.getByText('Order Rejected')).toBeDefined();
    expect(screen.getByText('Damaged goods in warehouse')).toBeDefined();
  });
});
