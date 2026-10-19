import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NearExpiryTable } from '../components/NearExpiryTable';
import { ExpiredStockTable } from '../components/ExpiredStockTable';
import { RemoveExpiredModal } from '../components/RemoveExpiredModal';
import * as hooks from '../hooks';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Alerts Components', () => {
  const mockNearExpiry = [
    {
      batchId: 1,
      medicineId: 10,
      medicineName: 'Paracetamol 500mg',
      batchNumber: 'BATCH-A1',
      expiryDate: '2026-11-01',
      daysLeft: 12,
      quantityOnHand: 100,
      mrp: '50.00',
      sellingPrice: '40.00',
    },
  ];

  const mockExpired = [
    {
      batchId: 2,
      medicineId: 11,
      medicineName: 'Amoxicillin 250mg',
      batchNumber: 'BATCH-B2',
      expiryDate: '2026-09-01',
      daysExpired: 45,
      quantityOnHand: 40,
      mrp: '75.00',
      sellingPrice: '60.00',
    },
  ];

  it('renders NearExpiryTable with medicine and days remaining badge', () => {
    renderWithClient(<NearExpiryTable items={mockNearExpiry} isLoading={false} />);
    expect(screen.getByText('Paracetamol 500mg')).toBeDefined();
    expect(screen.getByText('BATCH-A1')).toBeDefined();
    expect(screen.getByText('12 days')).toBeDefined();
    expect(screen.getByText('100 units')).toBeDefined();
    expect(screen.getByText('Keep (Dismiss)')).toBeDefined();
  });

  it('renders ExpiredStockTable and allows opening removal modal', () => {
    renderWithClient(<ExpiredStockTable items={mockExpired} isLoading={false} />);
    expect(screen.getByText('Amoxicillin 250mg')).toBeDefined();
    expect(screen.getByText('BATCH-B2')).toBeDefined();
    expect(screen.getByText('45 days ago')).toBeDefined();
    expect(screen.getByText('Remove from Shelf')).toBeDefined();

    fireEvent.click(screen.getByText('Remove from Shelf'));
    expect(screen.getByText('Remove Expired Stock')).toBeDefined();
    expect(screen.getByText('Confirm Physical Removal')).toBeDefined();
  });

  it('submits RemoveExpiredModal with reason', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.spyOn(hooks, 'useRemoveExpiredBatchMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useRemoveExpiredBatchMutation>);

    const onClose = vi.fn();
    renderWithClient(
      <RemoveExpiredModal
        batch={mockExpired[0]}
        isOpen={true}
        onClose={onClose}
      />
    );

    const textarea = screen.getByPlaceholderText(/e\.g\. Incinerated/);
    fireEvent.change(textarea, { target: { value: 'Disposed in hospital bio-waste' } });

    const submitBtn = screen.getByText('Confirm Physical Removal');
    fireEvent.click(submitBtn);

    expect(mutateAsync).toHaveBeenCalledWith({
      batchId: 2,
      reason: 'Disposed in hospital bio-waste',
    });
  });
});
