import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchesTable } from '../components/BatchesTable';
import type { BatchRecord } from '../types';

describe('BatchesTable Component', () => {
  const mockBatches: BatchRecord[] = [
    {
      batchId: 1,
      medicineId: 10,
      medicineName: 'Amoxicillin 500mg',
      medicineCompany: 'Cipla',
      medicinePackSize: '10 capsules',
      gstRate: 12,
      batchNumber: 'AMX-001',
      expiryDate: '2028-05-15',
      mrp: '120.00',
      sellingPrice: '90.00',
      purchaseRate: '70.00',
      priceInclGst: '100.80',
      quantityOnHand: 40,
      status: 'ACTIVE',
      gtin: '08901234567890',
      daysLeft: 500, // Safe (>90d)
      expiryAlertDismissedAt: null,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
    {
      batchId: 2,
      medicineId: 11,
      medicineName: 'Paracetamol 650mg',
      medicineCompany: 'Apex',
      medicinePackSize: '15 tablets',
      gstRate: 12,
      batchNumber: 'PCM-002',
      expiryDate: '2026-11-20',
      mrp: '50.00',
      sellingPrice: '35.00',
      purchaseRate: '25.00',
      priceInclGst: '39.20',
      quantityOnHand: 15,
      status: 'ACTIVE',
      gtin: null,
      daysLeft: 33, // Near expiry (<=90d)
      expiryAlertDismissedAt: null,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
    {
      batchId: 3,
      medicineId: 12,
      medicineName: 'Cough Syrup',
      medicineCompany: 'Dabur',
      medicinePackSize: '100ml',
      gstRate: 12,
      batchNumber: 'CS-003',
      expiryDate: '2025-01-01',
      mrp: '80.00',
      sellingPrice: '60.00',
      purchaseRate: '40.00',
      priceInclGst: '67.20',
      quantityOnHand: 0,
      status: 'BLOCKED',
      gtin: null,
      daysLeft: -600, // Expired (<0d)
      expiryAlertDismissedAt: null,
      createdAt: '2025-01-01T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
  ];

  it('renders batches with appropriate expiry badges', () => {
    render(
      <BatchesTable
        batches={mockBatches}
        onAdjust={vi.fn()}
        onToggleStatus={vi.fn()}
      />
    );

    // Medicine names and batch numbers
    expect(screen.getByText('Amoxicillin 500mg')).toBeDefined();
    expect(screen.getByText('AMX-001')).toBeDefined();
    expect(screen.getByText('Paracetamol 650mg')).toBeDefined();
    expect(screen.getByText('PCM-002')).toBeDefined();

    // Badges: safe, near-expiry, expired
    expect(screen.getByText('500d left')).toBeDefined();
    expect(screen.getByText('Expires in 33d')).toBeDefined();
    expect(screen.getByText(/Expired \(600d ago\)/)).toBeDefined();
  });

  it('invokes onAdjust when Adjust button is clicked', () => {
    const handleAdjust = vi.fn();
    render(
      <BatchesTable
        batches={mockBatches}
        onAdjust={handleAdjust}
        onToggleStatus={vi.fn()}
      />
    );

    const adjustBtns = screen.getAllByRole('button', { name: /Adjust/i });
    fireEvent.click(adjustBtns[0]!);

    expect(handleAdjust).toHaveBeenCalledTimes(1);
    expect(handleAdjust).toHaveBeenCalledWith(mockBatches[0]);
  });

  it('invokes onToggleStatus when status badge is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <BatchesTable
        batches={mockBatches}
        onAdjust={vi.fn()}
        onToggleStatus={handleToggle}
      />
    );

    const activeBadges = screen.getAllByRole('button', { name: 'ACTIVE' });
    fireEvent.click(activeBadges[0]!);

    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleToggle).toHaveBeenCalledWith(mockBatches[0]);
  });
});
