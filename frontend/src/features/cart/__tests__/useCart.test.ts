import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../useCart';

describe('useCart Hook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with empty items and zero total', () => {
    const { result } = renderHook(() => useCart());

    expect(result.current.items).toEqual([]);
    expect(result.current.totalQuantity).toBe(0);
    expect(result.current.subtotal).toBe('0.00');
  });

  it('adds an item to the cart and calculates subtotal correctly', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        medicineId: 1,
        name: 'Paracetamol 500mg',
        company: 'Cipla',
        packSize: '10 Tablets',
        priceInclGst: '20.50',
        mrp: '25.00',
        gstRate: '12.00',
        maxAvailable: 100,
      }, 2);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalQuantity).toBe(2);
    expect(result.current.subtotal).toBe('41.00');
    expect(result.current.getItemQuantity(1)).toBe(2);
  });

  it('clamps added quantity to maxAvailable ceiling', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        medicineId: 2,
        name: 'Limited Stock Medicine',
        company: 'Abbott',
        packSize: '1 Strip',
        priceInclGst: '50.00',
        mrp: '60.00',
        gstRate: '12.00',
        maxAvailable: 5,
      }, 10);
    });

    expect(result.current.totalQuantity).toBe(5);
    expect(result.current.getItemQuantity(2)).toBe(5);
  });

  it('updates quantity and removes item when quantity set to 0', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        medicineId: 3,
        name: 'Cough Syrup',
        company: 'Sun Pharma',
        packSize: '100ml',
        priceInclGst: '85.00',
        mrp: '95.00',
        gstRate: '12.00',
        maxAvailable: 20,
      }, 3);
    });

    act(() => {
      result.current.updateQuantity(3, 5);
    });
    expect(result.current.getItemQuantity(3)).toBe(5);

    act(() => {
      result.current.updateQuantity(3, 0);
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalQuantity).toBe(0);
  });

  it('removes item and clears cart', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        medicineId: 4,
        name: 'Vitamin C',
        company: 'Glaxo',
        packSize: '30 Tablets',
        priceInclGst: '110.00',
        mrp: '130.00',
        gstRate: '12.00',
        maxAvailable: 50,
      }, 2);
    });

    act(() => {
      result.current.clearCart();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.totalQuantity).toBe(0);
    expect(result.current.subtotal).toBe('0.00');
  });
});
