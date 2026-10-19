import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PriceTag } from '../PriceTag';

describe('PriceTag UI Component', () => {
  it('renders selling price and struck-through MRP with savings percentage', () => {
    render(<PriceTag priceInclGst="120.00" mrp="150.00" gstRate="12" inStock={true} />);

    expect(screen.getByText('₹120.00')).toBeDefined();
    expect(screen.getByText('₹150.00')).toBeDefined();
    expect(screen.getByText('20% OFF')).toBeDefined();
    expect(screen.getByText('(Incl. 12% GST)')).toBeDefined();
  });

  it('renders "Out of Stock" badge when inStock is false', () => {
    render(<PriceTag priceInclGst="120.00" mrp="150.00" inStock={false} />);

    expect(screen.getByText('Out of Stock')).toBeDefined();
    expect(screen.queryByText('₹120.00')).toBeNull();
  });

  it('renders "Out of Stock" badge when priceInclGst is null', () => {
    render(<PriceTag priceInclGst={null} mrp={null} inStock={true} />);

    expect(screen.getByText('Out of Stock')).toBeDefined();
  });

  it('does not render struck-through MRP if price equals or exceeds MRP', () => {
    render(<PriceTag priceInclGst="150.00" mrp="150.00" inStock={true} />);

    expect(screen.getByText('₹150.00')).toBeDefined();
    expect(screen.queryByText(/% OFF/i)).toBeNull();
  });
});
