'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  RotateCw,
  MapPin,
  Package,
  IndianRupee,
  Clock,
  Building2,
  ArrowRight,
  Undo2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { usePartnerDeliveries, useReleaseDelivery } from './hooks/useDelivery';
import type { PartnerOrderRecord } from '@/lib/api/delivery.api';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function formatElapsed(dateStr: string | null) {
  if (!dateStr) return 'Recently';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PartnerOrdersView() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [releaseTarget, setReleaseTarget] = useState<PartnerOrderRecord | null>(null);
  const [releaseReason, setReleaseReason] = useState('');

  // Fetch all orders for current partner
  const { data, isLoading, isRefetching, refetch } = usePartnerDeliveries();
  const releaseMutation = useReleaseDelivery();

  const allOrders = data?.data || [];
  const activeOrders = allOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
  const pastOrders = allOrders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'REJECTED'
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const handleOpenReleaseModal = (order: PartnerOrderRecord) => {
    setReleaseTarget(order);
    setReleaseReason('');
  };

  const handleConfirmRelease = async () => {
    if (!releaseTarget) return;
    try {
      await releaseMutation.mutateAsync({
        orderId: releaseTarget.orderId,
        reason: releaseReason.trim() || undefined,
      });
      setReleaseTarget(null);
      setReleaseReason('');
      refetch();
    } catch {
      // Handled by toast in useReleaseDelivery
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Doorstep Deliveries
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            My Deliveries
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track claimed orders, perform doorstep verification, or review past drops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/delivery/pool"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors min-h-[44px]"
          >
            <Truck className="w-4 h-4" />
            Claim More
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RotateCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'active'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Active Deliveries
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'active'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {activeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'past'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Past Deliveries
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'past'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {pastOrders.length}
          </span>
        </button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" />
          <p className="mt-3 text-sm font-semibold">Loading deliveries...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 shadow-sm text-center">
          <EmptyState
            title={activeTab === 'active' ? 'No active deliveries' : 'No past deliveries'}
            description={
              activeTab === 'active'
                ? 'You do not have any orders out for delivery. Claim ready orders from the dispatch pool to begin.'
                : 'Completed and rejected doorstep deliveries will appear here.'
            }
          />
          {activeTab === 'active' && (
            <div className="mt-6 flex justify-center">
              <Link
                href="/delivery/pool"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-colors min-h-[44px]"
              >
                <Truck className="w-4 h-4" />
                Go to Dispatch Pool
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedOrders.map((order) => {
            const isActive = order.status === 'OUT_FOR_DELIVERY';
            const isDelivered = order.status === 'DELIVERED';

            return (
              <div
                key={order.orderId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Status & Order Number */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      {order.orderNumber}
                    </span>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Out For Delivery
                      </span>
                    ) : isDelivered ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                        <XCircle className="w-3.5 h-3.5" />
                        Refused
                      </span>
                    )}
                  </div>

                  {/* Pharmacy Name & Location */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                        {order.retailerShopName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pl-6">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{order.city}</span>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Items
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        {order.itemCount} {order.itemCount === 1 ? 'line' : 'lines'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Order Value
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-0.5">
                        <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                        {order.totalAmount}
                      </span>
                    </div>
                  </div>

                  {/* Timeline note */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {isActive
                        ? `Claimed ${formatElapsed(order.claimedAt)}`
                        : `Completed on ${formatDate(order.deliveredAt)}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {isActive ? (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      href={`/delivery/orders/${order.orderId}`}
                      className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <span>Start Doorstep Check</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleOpenReleaseModal(order)}
                      className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Release</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      href={`/delivery/orders/${order.orderId}`}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>View Delivery Summary</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Release Confirmation Modal */}
      <Modal
        isOpen={Boolean(releaseTarget)}
        onClose={() => setReleaseTarget(null)}
        title="Release Order to Pool"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold">
                Return Order #{releaseTarget?.orderNumber} to Dispatch Pool?
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                This order will be unassigned from you and immediately become available for other
                delivery partners to claim.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="release-reason"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Reason for release (optional)
            </label>
            <input
              id="release-reason"
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="e.g. Vehicle breakdown, unreachable location, emergency"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setReleaseTarget(null)}
              disabled={releaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRelease}
              isLoading={releaseMutation.isPending}
            >
              Confirm Release
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
