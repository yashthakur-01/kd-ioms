import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OrderItemPickCard } from '../components/OrderItemPickCard';
import type { ItemPickSuggestion, BatchPickSuggestion } from '../../../lib/api/orders.api';
import type { PickedAllocation } from '../hooks/useOrderPicking';

describe('OrderItemPickCard Component', () => {
  const sampleBatch: BatchPickSuggestion = {
    batchId: 10,
    batchNumber: 'AUG-B101',
    expiryDate: '2027-12-31',
    quantityOnHand: 20,
    sellingPrice: '80.00',
    mrp: '100.00',
    gstRate: '12.00',
    priceInclGst: '89.60',
    withinQuote: true,
    suggestedQty: 5,
  };

  const sampleItem: ItemPickSuggestion = {
    orderItemId: 1,
    medicineId: 101,
    medicineName: 'Augmentin 625 Duo',
    company: 'GSK',
    packSize: '10 Tablets',
    requestedQuantity: 5,
    quotedPriceInclGst: '90.00',
    suggestedTotalPicked: 5,
    shortfall: 0,
    batches: [sampleBatch],
  };

  const sampleAllocation: PickedAllocation = {
    batchId: 10,
    batchNumber: 'AUG-B101',
    expiryDate: '2027-12-31',
    quantity: 5,
    maxOnHand: 20,
    priceInclGst: '89.60',
    withinQuote: true,
    captureMethod: 'MANUAL',
  };

  it('renders item details, requested quantity, and FULL status badge when fully allocated', () => {
    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[sampleAllocation]}
        onApplySuggestion={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={vi.fn()}
      />
    );

    expect(screen.getByText('Augmentin 625 Duo')).toBeDefined();
    expect(screen.getByText(/GSK/)).toBeDefined();
    expect(screen.getByText(/FULL \(5\/5\)/)).toBeDefined();
    expect(screen.getAllByText('AUG-B101').length).toBeGreaterThan(0);
  });

  it('renders PARTIAL status badge and shortfall notice when partially picked', () => {
    const partialAllocation: PickedAllocation = {
      ...sampleAllocation,
      quantity: 3,
    };

    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[partialAllocation]}
        onApplySuggestion={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={vi.fn()}
      />
    );

    expect(screen.getByText(/PARTIAL \(3\/5\)/)).toBeDefined();
    expect(screen.getByText(/Shortfall Notice:/)).toBeDefined();
    expect(screen.getByText(/2 units unpicked/)).toBeDefined();
  });

  it('renders NONE status badge when no allocations exist', () => {
    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[]}
        onApplySuggestion={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={vi.fn()}
      />
    );

    expect(screen.getByText(/NONE \(0\/5\)/)).toBeDefined();
  });

  it('calls onApplySuggestion when FEFO suggestion chip is clicked', () => {
    const handleApply = vi.fn();
    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[]}
        onApplySuggestion={handleApply}
        onUpdateQuantity={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={vi.fn()}
      />
    );

    const pickButton = screen.getByText(/Pick 5/);
    fireEvent.click(pickButton);

    expect(handleApply).toHaveBeenCalledWith(sampleBatch);
  });

  it('calls onUpdateQuantity when stepper buttons are clicked', () => {
    const handleUpdate = vi.fn();
    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[sampleAllocation]}
        onApplySuggestion={vi.fn()}
        onUpdateQuantity={handleUpdate}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={vi.fn()}
      />
    );

    const minusBtn = screen.getByLabelText('Decrease quantity');
    fireEvent.click(minusBtn);
    expect(handleUpdate).toHaveBeenCalledWith(10, 4, 20);
  });

  it('calls onOpenScanModal when Scan Pack button is clicked', () => {
    const handleScanModal = vi.fn();
    render(
      <OrderItemPickCard
        item={sampleItem}
        allocations={[]}
        onApplySuggestion={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAddManualBatch={vi.fn()}
        onOpenScanModal={handleScanModal}
      />
    );

    const scanBtn = screen.getByRole('button', { name: /Scan Pack/i });
    fireEvent.click(scanBtn);
    expect(handleScanModal).toHaveBeenCalledWith(101);
  });
});
