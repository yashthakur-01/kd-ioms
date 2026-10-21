'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Trash2, AlertTriangle, Check, RefreshCw, ShoppingCart } from 'lucide-react';
import { useCart } from './useCart';
import { placeOrder } from '../../lib/api/orders.api';
import { ApiError } from '../../lib/api/api-error';

export interface CartCheckoutViewProps {
  onBehalfRetailerId?: string;
  onBehalfPharmacyName?: string;
}

export function CartCheckoutView({ onBehalfRetailerId, onBehalfPharmacyName }: CartCheckoutViewProps) {
  const router = useRouter();
  const { items, totalQuantity, subtotal, updateQuantity, removeItem, clearCart } = useCart();

  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priceChangedAlert, setPriceChangedAlert] = useState(false);

  // Shortage mapping: medicineId -> available
  const [shortages, setShortages] = useState<Record<number, number>>({});

  // Idempotency key state (generated on submit and reused on network retry)
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Regenerate key and clear alerts if cart items or note change
  const currentSignature = useMemo(() => {
    const itemsSig = items.map((i) => `${i.medicineId}:${i.quantity}:${i.priceInclGst}`).join('|');
    return `${itemsSig}::${note}`;
  }, [items, note]);

  const [prevSignature, setPrevSignature] = useState(currentSignature);
  if (currentSignature !== prevSignature) {
    setPrevSignature(currentSignature);
    setIdempotencyKey('');
    setShortages({});
    setPriceChangedAlert(false);
    setErrorMessage(null);
  }

  // Handle single "Use Available" click
  const handleUseAvailable = useCallback(
    (medicineId: number, available: number) => {
      if (available > 0) {
        updateQuantity(medicineId, available);
      } else {
        removeItem(medicineId);
      }
      setShortages((prev) => {
        const next = { ...prev };
        delete next[medicineId];
        return next;
      });
    },
    [updateQuantity, removeItem]
  );

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setShortages({});
    setPriceChangedAlert(false);

    try {
      let keyToUse = idempotencyKey;
      if (!keyToUse) {
        keyToUse = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000';
        setIdempotencyKey(keyToUse);
      }

      const payload = {
        retailerId: onBehalfRetailerId || undefined,
        note: note.trim() || null,
        items: items.map((i) => ({
          medicineId: i.medicineId,
          quantity: i.quantity,
          quotedPriceInclGst: i.priceInclGst,
        })),
      };

      const res = await placeOrder(payload, keyToUse);

      if (res.success && res.data) {
        clearCart();
        router.push(`/orders/${res.data.orderId}`);
      } else {
        setErrorMessage(res.message || 'Failed to place order');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const details = err.details as { items?: Array<{ medicineId: number; available: number }> } | undefined;
        if (err.code === 'INSUFFICIENT_STOCK' && details?.items) {
          const shortageMap: Record<number, number> = {};
          for (const item of details.items) {
            shortageMap[item.medicineId] = item.available;
          }
          setShortages(shortageMap);
          setErrorMessage('Some items have less stock available than requested. Please adjust quantities below.');
        } else if (err.code === 'PRICE_CHANGED') {
          setPriceChangedAlert(true);
          setErrorMessage('One or more medicine prices have updated. Please review your cart.');
        } else {
          setErrorMessage(err.message || 'An error occurred while placing your order.');
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Network error occurred. You can retry safely without duplicate charge.';
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-inner mb-6">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
          Your Cart is Empty
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-8 text-base">
          Looks like you haven&apos;t added any medicines yet. Browse our live catalog to view stock and place orders.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <ShoppingCart className="w-5 h-5" />
          Browse Medicine Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* On-behalf Banner */}
      {onBehalfRetailerId && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold text-sm uppercase tracking-wider block">Ordering on Behalf</span>
            <span className="text-base font-medium">
              Placing order for pharmacy: <strong className="font-bold">{onBehalfPharmacyName || onBehalfRetailerId}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Order Checkout
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review your order lines, verify quantities, and complete order placement.
          </p>
        </div>

        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Link>
      </div>

      {/* Error & Warning Banners */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold block">Notice</span>
            {errorMessage}
          </div>
        </div>
      )}

      {priceChangedAlert && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold block">Prices Updated</span>
            One or more items in your cart had prices adjusted in the live inventory catalog. Please review the updated figures before continuing.
          </div>
        </div>
      )}

      {/* Main Grid: Left Items List, Right Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Order Items</h2>
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Cart
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {items.map((item) => {
                const isShort = shortages[item.medicineId] !== undefined;
                const available = shortages[item.medicineId] ?? item.maxAvailable;
                const lineTotalPaise = Math.round(parseFloat(item.priceInclGst) * 100) * item.quantity;
                const lineTotalFormatted = (lineTotalPaise / 100).toFixed(2);

                return (
                  <div
                    key={item.medicineId}
                    className={`p-5 transition-colors ${
                      isShort
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-l-4 border-rose-500'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Item Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                            {item.name}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            {item.packSize}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {item.company}
                        </p>

                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{item.priceInclGst}
                          </span>
                          <span className="text-xs text-slate-400 line-through">
                            MRP ₹{item.mrp}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            (Incl. {item.gstRate}% GST)
                          </span>
                        </div>

                        {/* Shortage Alert & Action */}
                        {isShort && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Only {available} available
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUseAvailable(item.medicineId, available)}
                              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 underline flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              {available > 0 ? `Use ${available}` : 'Remove item'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 shadow-inner">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-bold text-sm text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[80px]">
                          <span className="text-xs text-slate-400 block font-medium">Line Total</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-base">
                            ₹{lineTotalFormatted}
                          </span>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.medicineId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Instructions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <label htmlFor="order-note" className="block text-sm font-bold text-slate-900 dark:text-white mb-1">
              Delivery Notes / Instructions (Optional)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Add any special timing or access requirements for warehouse packing and delivery.
            </p>
            <div className="relative">
              <textarea
                id="order-note"
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Please deliver between 10 AM - 1 PM, check box seal before handover..."
                style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-black !text-black placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
              <span className="absolute bottom-3 right-3 text-[11px] font-semibold text-slate-400">
                {note.length} / 300
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-1 space-y-4 sticky top-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800">
              Payment & Summary
            </h2>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Items</span>
                <span className="font-semibold text-slate-900 dark:text-white">{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Unique Lines</span>
                <span className="font-semibold text-slate-900 dark:text-white">{items.length}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax Breakdown</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">GST Included</span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900 dark:text-white">Grand Total</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{subtotal}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting || items.length === 0 || Object.keys(shortages).length > 0}
              onClick={handleSubmitOrder}
              className="w-full mt-2 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold text-base transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Placing Order...
                </>
              ) : Object.keys(shortages).length > 0 ? (
                'Adjust Shortages to Place Order'
              ) : (
                `Place Order • ₹${subtotal}`
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-4 leading-relaxed">
              By confirming, inventory will be reserved immediately. You can cancel your order at any time while in PLACED status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
