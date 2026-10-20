'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  X,
  Ban,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Truck,
  Phone,
  Camera,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { getOrderById, cancelOrder, rejectOrder, type OrderDetailData } from '../../lib/api/orders.api';
import { overrideDeliveryOrder } from '../../lib/api/delivery.api';
import { useAuth } from '../../providers/AuthProvider';
import { OrderTimeline } from './OrderTimeline';
import { OrderRejectModal } from './components/OrderRejectModal';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { InvoiceDetailModal } from '../../components/invoices/InvoiceDetailModal';

function formatDate(isoString?: string | null) {
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
}

export interface OrderDetailViewProps {
  orderId: number;
}

export function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Modal state (Retailer)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Rejection Modal state (Admin)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Admin Override Modal state
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Enlarged Delivery Photo Modal state
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  // Invoice Detail Modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

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

  const handleConfirmReject = async (reason: string) => {
    if (isRejecting) return;
    setIsRejecting(true);
    try {
      const res = await rejectOrder(orderId, reason);
      if (res.success && res.data) {
        setIsRejectModalOpen(false);
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'REJECTED',
                rejectionReason: res.data.rejectionReason,
                history: [
                  ...prev.history,
                  {
                    historyId: Date.now(),
                    fromStatus: prev.status,
                    toStatus: 'REJECTED',
                    actorName: user?.username || 'Admin',
                    note: reason,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reject order');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmOverride = async () => {
    if (isOverriding) return;
    if (!overrideReason.trim()) {
      setOverrideError('Please provide a reason for overriding delivery.');
      return;
    }

    setIsOverriding(true);
    setOverrideError(null);

    try {
      const res = await overrideDeliveryOrder(orderId, { reason: overrideReason.trim() });
      if (res.data) {
        setIsOverrideModalOpen(false);
        setOverrideReason('');
        // Update local order state to APPROVED
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'APPROVED',
                deliveryPartner: null,
                history: [
                  ...prev.history,
                  {
                    historyId: Date.now(),
                    fromStatus: 'OUT_FOR_DELIVERY',
                    toStatus: 'APPROVED',
                    actorName: user?.username || 'Admin',
                    note: `Admin override returned to pool: ${overrideReason.trim()}`,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null
        );
      }
    } catch (err: unknown) {
      setOverrideError(err instanceof Error ? err.message : 'Failed to execute delivery override.');
    } finally {
      setIsOverriding(false);
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
  const canAdminReject = isAdmin && (isPlaced || (order.status === 'APPROVED' && !order.deliveryPartner));

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

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Admin Pick & Approve Button */}
          {isAdmin && isPlaced && (
            <Link
              href={`/orders/${order.orderId}/pick`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Pick & Approve
            </Link>
          )}

          {/* Admin Reject Button */}
          {canAdminReject && (
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-colors shadow-sm"
            >
              <Ban className="w-4 h-4" />
              Reject Order
            </button>
          )}

          {/* Admin Override Delivery Button */}
          {isAdmin && order.status === 'OUT_FOR_DELIVERY' && (
            <button
              type="button"
              onClick={() => {
                setOverrideReason('');
                setOverrideError(null);
                setIsOverrideModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-800 transition-colors shadow-sm min-h-[36px]"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              Override: Return to Pool
            </button>
          )}

          {/* Tax Invoice Button */}
          {order.invoice && (
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 transition-colors shadow-sm min-h-[36px]"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              Tax Invoice ({order.invoice.invoiceNumber})
            </button>
          )}

          {/* Retailer Cancel Button (Visible only while PLACED) */}
          {!isAdmin && isPlaced && (
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

          {order.deliveryPartner && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-500 dark:text-slate-400">Delivery Partner:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {order.deliveryPartner.username}
              </span>
              {order.deliveryPartner.phone && (
                <a
                  href={`tel:${order.deliveryPartner.phone}`}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-2"
                >
                  <Phone className="w-3 h-3" />
                  {order.deliveryPartner.phone}
                </a>
              )}
            </div>
          )}

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
        <div className="lg:col-span-1 space-y-6">
          <OrderTimeline
            currentStatus={order.status}
            history={order.history}
            cancelledAt={order.cancelledAt}
            rejectionReason={order.rejectionReason}
          />

          {/* Delivery Proof Photo Thumbnail (if available) */}
          {order.deliveryPhotoPath && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  Delivery Proof
                </span>
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(true)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Enlarge
                </button>
              </div>

              <div
                className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer group"
                onClick={() => setIsProofModalOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.deliveryPhotoPath}
                  alt="Delivery proof"
                  className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            </div>
          )}
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
                    <th className="py-3 px-4 text-center">Delivery</th>
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
                        <td className="py-4 px-4 text-center">
                          {item.deliveryStatus === 'ACCEPTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Accepted
                            </span>
                          ) : item.deliveryStatus === 'REFUSED' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                                <XCircle className="w-3 h-3" />
                                Refused
                              </span>
                              {item.refusalReason && (
                                <span
                                  className="block text-[10px] text-rose-600 dark:text-rose-400 max-w-[130px] truncate mx-auto"
                                  title={item.refusalReason}
                                >
                                  {item.refusalReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400">
                              Pending
                            </span>
                          )}
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

      {/* Admin Rejection Modal */}
      <OrderRejectModal
        isOpen={isRejectModalOpen}
        orderNumber={order.orderNumber}
        isSubmitting={isRejecting}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
      />

      {/* Admin Override: Return to Pool Modal */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title="Override Delivery: Return to Pool"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold">Return Order #{order.orderNumber} to Dispatch Pool?</p>
              <p className="text-slate-600 dark:text-slate-400">
                This order is currently out for delivery by{' '}
                <strong>{order.deliveryPartner?.username || 'assigned partner'}</strong>.
                Overriding will return the order to APPROVED in the dispatch pool so another partner
                can claim it.
              </p>
            </div>
          </div>

          {overrideError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {overrideError}
            </div>
          )}

          <div>
            <label
              htmlFor="override-reason"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Reason for Override <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="override-reason"
              rows={2}
              maxLength={200}
              placeholder="e.g. Partner unreachable, delivery deadline approaching..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={isOverriding}
              onClick={() => setIsOverrideModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={isOverriding || !overrideReason.trim()}
              isLoading={isOverriding}
              onClick={handleConfirmOverride}
            >
              Confirm Override
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enlarged Proof Photo Modal */}
      <Modal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        title="Delivery Proof Photo"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.deliveryPhotoPath || ''}
            alt="Delivery proof enlarged"
            className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950"
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsProofModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tax Invoice Detail Modal */}
      {order.invoice && (
        <InvoiceDetailModal
          invoiceId={order.invoice.invoiceId}
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
