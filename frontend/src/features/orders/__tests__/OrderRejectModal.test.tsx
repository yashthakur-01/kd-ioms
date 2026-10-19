import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OrderRejectModal } from '../components/OrderRejectModal';

describe('OrderRejectModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <OrderRejectModal
        isOpen={false}
        orderNumber="ORD-000001"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header, presets, and textarea when isOpen is true', () => {
    render(
      <OrderRejectModal
        isOpen={true}
        orderNumber="ORD-000001"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/Reject Order ORD-000001/)).toBeDefined();
    expect(screen.getByText('Stock damaged or expired on shelf')).toBeDefined();
    expect(screen.getByPlaceholderText(/State clear reasons/)).toBeDefined();
  });

  it('selects a preset when preset button is clicked', () => {
    render(
      <OrderRejectModal
        isOpen={true}
        orderNumber="ORD-000001"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const presetBtn = screen.getByText('Stock damaged or expired on shelf');
    fireEvent.click(presetBtn);

    const textarea = screen.getByPlaceholderText(/State clear reasons/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Stock damaged or expired on shelf');
  });

  it('submits successfully when confirmed with valid reason', () => {
    const handleConfirm = vi.fn();
    render(
      <OrderRejectModal
        isOpen={true}
        orderNumber="ORD-000001"
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText(/State clear reasons/);
    fireEvent.change(textarea, { target: { value: 'Distributor out of stock' } });

    const submitBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    fireEvent.click(submitBtn);

    expect(handleConfirm).toHaveBeenCalledWith('Distributor out of stock');
  });

  it('calls onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <OrderRejectModal
        isOpen={true}
        orderNumber="ORD-000001"
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
