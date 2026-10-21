import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OrderBatchScannerModal } from '../components/OrderBatchScannerModal';
import type { ItemPickSuggestion, BatchPickSuggestion } from '../../../lib/api/orders.api';
import * as ordersApi from '../../../lib/api/orders.api';

describe('OrderBatchScannerModal Component', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open with tabs and order number', () => {
    render(
      <OrderBatchScannerModal
        isOpen={true}
        onClose={vi.fn()}
        orderNumber="ORD-2026-0001"
        items={[sampleItem]}
        allocations={{}}
        onDeductBatch={vi.fn()}
      />
    );

    expect(screen.getByText(/Scan & Deduct Batch Quantity/)).toBeDefined();
    expect(screen.getAllByText(/ORD-2026-0001/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Barcode \/ Gun \/ Manual/)).toBeDefined();
    expect(screen.getByText(/Camera Scanner/)).toBeDefined();
    expect(screen.getByText(/Order Items List/)).toBeDefined();
  });

  it('allows browsing order items and selecting a batch to deduct', async () => {
    const handleDeduct = vi.fn();
    render(
      <OrderBatchScannerModal
        isOpen={true}
        onClose={vi.fn()}
        orderNumber="ORD-2026-0001"
        items={[sampleItem]}
        allocations={{}}
        onDeductBatch={handleDeduct}
      />
    );

    // Switch to Order Items List tab
    const browseTab = screen.getByText('Order Items List');
    fireEvent.click(browseTab);

    // Click the batch button
    const batchButton = screen.getByText('AUG-B101');
    fireEvent.click(batchButton);

    // Should transition to deduction quantity screen
    expect(screen.getByText('Matched Medicine')).toBeDefined();
    expect(screen.getByText('Quantity to Deduct & Allocate')).toBeDefined();

    // Confirm deduction
    const deductButton = screen.getByRole('button', { name: /Deduct & Allocate 5 Unit\(s\)/i });
    fireEvent.click(deductButton);

    expect(handleDeduct).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ batchId: 10, batchNumber: 'AUG-B101' }),
      5,
      'MANUAL',
      undefined
    );
  });

  it('resolves batch number via manual input and allows custom quantity deduction', async () => {
    const handleDeduct = vi.fn();
    render(
      <OrderBatchScannerModal
        isOpen={true}
        onClose={vi.fn()}
        orderNumber="ORD-2026-0001"
        items={[sampleItem]}
        allocations={{}}
        onDeductBatch={handleDeduct}
      />
    );

    const input = screen.getByPlaceholderText(/Point barcode scanner gun here/i);
    fireEvent.change(input, { target: { value: 'AUG-B101' } });

    const findButton = screen.getByRole('button', { name: /Find Batch/i });
    fireEvent.click(findButton);

    // Check step 2 is visible
    expect(await screen.findByText('Quantity to Deduct & Allocate')).toBeDefined();

    // Change deduction quantity to 3
    const qtyInput = screen.getByLabelText('Quantity to Deduct & Allocate');
    fireEvent.change(qtyInput, { target: { value: '3' } });

    // Confirm deduction
    const deductButton = screen.getByRole('button', { name: /Deduct & Allocate 3 Unit\(s\)/i });
    fireEvent.click(deductButton);

    expect(handleDeduct).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ batchId: 10, batchNumber: 'AUG-B101' }),
      3,
      'SCAN_GUN',
      'AUG-B101'
    );
  });
});
