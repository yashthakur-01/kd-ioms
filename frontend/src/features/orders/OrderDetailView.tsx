'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, X, Ban } from 'lucide-react';
import { getOrderById, cancelOrder, type OrderDetailData } from '../../lib/api/orders.api';
import { OrderTimeline } from './OrderTimeline';

export interface OrderDetailViewProps {
  orderId: number;
}

export function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getOrderById(orderId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setOrder(res.data);
        } else {
          setError(res.message || 'Failed to load order');
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Order not found');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleConfirmCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await cancelOrder(orderId, cancelReason.trim() || null);
      if (res.success && res.data) {
        setIsCancelModalOpen(false);
        // Update local order state to CANCELLED
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'CANCELLED',
                cancelledAt: res.data.cancelledAt,
                history: [
                  ...prev.history,
                  {
                    historyId: Date.now(),
                    fromStatus: 'PLACED',
                    toStatus: 'CANCELLED',
                    actorName: 'You',
                    note: cancelReason.trim() || 'Order cancelled by retailer',
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null
        );
      } else {
        setCancelError(res.message || 'Failed to cancel order');
      }
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel order. It may have already been approved or dispatched.');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Ban className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Not Found</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{error || 'This order does not exist or you do not have permission to view it.'}</p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
      </div>
    );
  }

  const isPlaced = order.status === 'PLACED';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back Link & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Orders
        </Link>

        {/* Cancel Button (Visible only while PLACED) */}
        {isPlaced && (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-colors shadow-sm"
          >
            <Ban className="w-4 h-4" />
            Cancel Order
          </button>
        )}
      </div>

      {/* Order Header Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Order {order.orderNumber}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                order.status === 'PLACED'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : order.status === 'APPROVED'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  : order.status === 'OUT_FOR_DELIVERY'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : order.status === 'DELIVERED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {order.status}
            </span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Placed on <strong className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(order.createdAt)}</strong> for <strong className="font-semibold text-slate-700 dark:text-slate-300">{order.retailer.pharmacyName}</strong>
          </p>

          {order.note && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <strong className="font-bold text-slate-700 dark:text-slate-300">Delivery Note: </strong>
              {order.note}
            </p>
          )}
        </div>

        <div className="md:text-right shrink-0">
          <span className="text-xs text-slate-400 block font-medium">Order Total (Incl. GST)</span>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{order.totalAmount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
            {order.itemCount} {order.itemCount === 1 ? 'item line' : 'item lines'}
          </span>
        </div>
      </div>

      {/* Grid: Timeline on Left/Top, Line Items on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Timeline Column */}
        <div className="lg:col-span-1">
          <OrderTimeline
            currentStatus={order.status}
            history={order.history}
            cancelledAt={order.cancelledAt}
            rejectionReason={order.rejectionReason}
          />
        </div>

        {/* Items Table Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ordered Medicines</h2>
              <span className="text-xs text-slate-400 font-semibold">{order.items.length} lines</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Medicine</th>
                    <th className="py-3 px-5 text-center">Qty</th>
                    <th className="py-3 px-5 text-right">Unit Price</th>
                    <th className="py-3 px-5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {order.items.map((item) => {
                    const linePaise = Math.round(parseFloat(item.quotedPriceInclGst) * 100) * item.requestedQuantity;
                    const lineTotalFormatted = (linePaise / 100).toFixed(2);

                    return (
                      <tr key={item.orderItemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {item.medicineName}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {item.company} • {item.packSize}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center font-bold text-slate-900 dark:text-white">
                          {item.requestedQuantity}
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-slate-700 dark:text-slate-300">
                          ₹{item.quotedPriceInclGst}
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{lineTotalFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="p-5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">Grand Total</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{order.totalAmount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Cancel Order {order.orderNumber}?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to cancel this order? Reserved stock will be immediately released back to the warehouse catalog.
            </p>

            {cancelError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {cancelError}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                id="cancel-reason"
                rows={2}
                maxLength={300}
                placeholder="e.g. Sourced from local stock, patient prescription changed..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
