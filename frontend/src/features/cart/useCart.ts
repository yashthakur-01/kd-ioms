'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CartItem } from './cart.types';
import { useAuth } from '../../providers/AuthProvider';

function getStorageKey(userId?: string | null): string {
  return userId ? `kd_cart_${userId}` : 'kd_cart_guest';
}

function parseStoredItems(key: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredItems(key: string, items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(items));
    }
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('cart-storage-updated'));
  } catch (err) {
    console.error('[CartStorage] Failed to save cart items:', err);
  }
}

export function useCart() {
  let userId: string | null = null;
  try {
    const auth = useAuth();
    userId = auth.user?.id || null;
  } catch {
    // Graceful fallback if invoked outside AuthProvider
    userId = null;
  }

  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const [prevKey, setPrevKey] = useState(storageKey);
  const [items, setItems] = useState<CartItem[]>(() => parseStoredItems(storageKey));

  if (prevKey !== storageKey) {
    setPrevKey(storageKey);
    setItems(parseStoredItems(storageKey));
  }

  // Listen to cross-tab storage changes and intra-window updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setItems(parseStoredItems(storageKey));
      }
    };

    const handleCustomEvent = () => {
      setItems(parseStoredItems(storageKey));
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('cart-storage-updated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('cart-storage-updated', handleCustomEvent);
    };
  }, [storageKey]);

  /**
   * Adds an item to the cart or increments existing quantity up to maxAvailable
   */
  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantityToAdd: number = 1) => {
      if (quantityToAdd <= 0 || item.maxAvailable <= 0) return;

      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.medicineId === item.medicineId);
        let next: CartItem[];

        if (existingIndex >= 0) {
          const current = prev[existingIndex];
          const newQty = Math.min(item.maxAvailable, current.quantity + quantityToAdd);
          next = [...prev];
          next[existingIndex] = { ...current, quantity: newQty, maxAvailable: item.maxAvailable, priceInclGst: item.priceInclGst };
        } else {
          const validQty = Math.min(item.maxAvailable, quantityToAdd);
          next = [...prev, { ...item, quantity: validQty }];
        }

        saveStoredItems(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  /**
   * Updates quantity of an existing item in cart, clamping between 1 and maxAvailable.
   * If newQty <= 0, removes the item.
   */
  const updateQuantity = useCallback(
    (medicineId: number, newQuantity: number) => {
      setItems((prev) => {
        let next: CartItem[];
        if (newQuantity <= 0) {
          next = prev.filter((i) => i.medicineId !== medicineId);
        } else {
          next = prev.map((item) => {
            if (item.medicineId === medicineId) {
              const clamped = Math.min(item.maxAvailable, Math.max(1, newQuantity));
              return { ...item, quantity: clamped };
            }
            return item;
          });
        }
        saveStoredItems(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  /**
   * Removes an item from the cart
   */
  const removeItem = useCallback(
    (medicineId: number) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.medicineId !== medicineId);
        saveStoredItems(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  /**
   * Clears all items from cart
   */
  const clearCart = useCallback(() => {
    setItems([]);
    saveStoredItems(storageKey, []);
  }, [storageKey]);

  /**
   * Returns current quantity for a specific medicine (0 if not in cart)
   */
  const getItemQuantity = useCallback(
    (medicineId: number): number => {
      const match = items.find((i) => i.medicineId === medicineId);
      return match ? match.quantity : 0;
    },
    [items]
  );

  /**
   * Derived totals
   */
  const totalQuantity = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }, [items]);

  const subtotalPaise = useMemo(() => {
    return items.reduce((acc, item) => {
      const pricePaise = Math.round(parseFloat(item.priceInclGst) * 100);
      return acc + pricePaise * item.quantity;
    }, 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return (subtotalPaise / 100).toFixed(2);
  }, [subtotalPaise]);

  return {
    items,
    totalQuantity,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getItemQuantity,
  };
}
