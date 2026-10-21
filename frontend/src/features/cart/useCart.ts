'use client';

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import type { CartItem } from './cart.types';
import { useAuth } from '../../providers/AuthProvider';

function getStorageKey(userId?: string | null): string {
  return userId ? `kd_cart_${userId}` : 'kd_cart_guest';
}

const EMPTY_ARRAY: CartItem[] = [];

interface CacheEntry {
  raw: string | null;
  items: CartItem[];
}

const cartCache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

// Global storage listener for cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('kd_cart_')) {
      cartCache.delete(e.key);
      notifyListeners();
    }
  });
}

function getCartSnapshot(key: string): CartItem[] {
  if (typeof window === 'undefined') return EMPTY_ARRAY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      cartCache.set(key, { raw: null, items: EMPTY_ARRAY });
      return EMPTY_ARRAY;
    }

    const cached = cartCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.items;
    }

    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : EMPTY_ARRAY;
    cartCache.set(key, { raw, items });
    return items;
  } catch {
    return EMPTY_ARRAY;
  }
}

function setCartItems(key: string, items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(key);
      cartCache.set(key, { raw: null, items: EMPTY_ARRAY });
    } else {
      const raw = JSON.stringify(items);
      window.localStorage.setItem(key, raw);
      cartCache.set(key, { raw, items });
    }
  } catch (err) {
    console.error('[CartStorage] Failed to save cart items:', err);
  }
  notifyListeners();
}

export function _clearCartCacheForTesting() {
  cartCache.clear();
  listeners.clear();
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

  const subscribe = useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => {
      listeners.delete(onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return getCartSnapshot(storageKey);
  }, [storageKey]);

  const getServerSnapshot = useCallback(() => {
    return EMPTY_ARRAY;
  }, []);

  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Adds an item to the cart or increments existing quantity up to maxAvailable
   */
  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantityToAdd: number = 1) => {
      if (quantityToAdd <= 0 || item.maxAvailable <= 0) return;

      const current = getCartSnapshot(storageKey);
      const existingIndex = current.findIndex((i) => i.medicineId === item.medicineId);
      let next: CartItem[];

      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const newQty = Math.min(item.maxAvailable, existing.quantity + quantityToAdd);
        next = [...current];
        next[existingIndex] = {
          ...existing,
          quantity: newQty,
          maxAvailable: item.maxAvailable,
          priceInclGst: item.priceInclGst,
        };
      } else {
        const validQty = Math.min(item.maxAvailable, quantityToAdd);
        next = [...current, { ...item, quantity: validQty }];
      }

      setCartItems(storageKey, next);
    },
    [storageKey]
  );

  /**
   * Updates quantity of an existing item in cart, clamping between 1 and maxAvailable.
   * If newQty <= 0, removes the item.
   */
  const updateQuantity = useCallback(
    (medicineId: number, newQuantity: number) => {
      const current = getCartSnapshot(storageKey);
      let next: CartItem[];
      if (newQuantity <= 0) {
        next = current.filter((i) => i.medicineId !== medicineId);
      } else {
        next = current.map((item) => {
          if (item.medicineId === medicineId) {
            const clamped = Math.min(item.maxAvailable, Math.max(1, newQuantity));
            return { ...item, quantity: clamped };
          }
          return item;
        });
      }
      setCartItems(storageKey, next);
    },
    [storageKey]
  );

  /**
   * Removes an item from the cart
   */
  const removeItem = useCallback(
    (medicineId: number) => {
      const current = getCartSnapshot(storageKey);
      const next = current.filter((i) => i.medicineId !== medicineId);
      setCartItems(storageKey, next);
    },
    [storageKey]
  );

  /**
   * Clears all items from cart
   */
  const clearCart = useCallback(() => {
    setCartItems(storageKey, []);
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

