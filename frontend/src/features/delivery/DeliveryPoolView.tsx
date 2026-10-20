'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  RotateCw,
  MapPin,
  Package,
  IndianRupee,
  Clock,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { useDeliveryPool, useClaimDelivery } from './hooks/useDelivery';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function formatElapsed(dateStr: string | null) {
  if (!dateStr) return 'Recently approved';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

export function DeliveryPoolView() {
  const router = useRouter();
  const [claimingOrderId, setClaimingOrderId] = useState<number | null>(null);
  const [raceModalOpen, setRaceModalOpen] = useState(false);
  const [raceModalMessage, setRaceModalMessage] = useState('');

  const { data, isLoading, isRefetching, refetch } = useDeliveryPool();
  const claimMutation = useClaimDelivery();

  const orders = data?.data || [];

  const handleClaim = async (orderId: number) => {
    setClaimingOrderId(orderId);
    try {
      const res = await claimMutation.mutateAsync(orderId);
      router.push(`/delivery/orders/${res.data.orderId}`);
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code === 'ORDER_ALREADY_CLAIMED') {
        setRaceModalMessage(
          'Another delivery partner claimed this order moments ago. The pool has been updated.'
        );
        setRaceModalOpen(true);
        refetch();
      }
    } finally {
      setClaimingOrderId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Live Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Live Dispatch Feed
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Wholesale Dispatch Pool
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {orders.length} Ready
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Claim approved orders first come, first served to start doorstep delivery.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <RotateCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-blue-600' : ''}`} />
          {isRefetching ? 'Refreshing...' : 'Refresh Pool'}
        </button>
      </div>

      {/* Orders Pool Feed */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" />
          <p className="mt-3 text-sm font-semibold">Loading available dispatch pool...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 shadow-sm text-center">
          <EmptyState
            title="No orders ready for pickup"
            description="All wholesale orders are currently assigned or awaiting picking approval. Check back shortly or refresh."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => {
            const isClaiming = claimingOrderId === order.orderId;

            return (
              <div
                key={order.orderId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Order Number and Elapsed Time */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      {order.orderNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {formatElapsed(order.approvedAt || order.createdAt)}
                    </span>
                  </div>

                  {/* Pharmacy Destination */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                        {order.retailer.shopName || order.retailer.pharmacyName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pl-6">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {order.retailer.city}
                        {order.retailer.pincode ? ` — ${order.retailer.pincode}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Items to Deliver
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
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
                </div>

                {/* Claim Button */}
                <button
                  type="button"
                  onClick={() => handleClaim(order.orderId)}
                  disabled={isClaiming || claimMutation.isPending}
                  className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isClaiming ? (
                    <>
                      <Spinner size="sm" />
                      Claiming Order...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      Claim Delivery
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Race Condition Conflict Modal */}
      <Modal
        isOpen={raceModalOpen}
        onClose={() => setRaceModalOpen(false)}
        title="Order Already Claimed"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs sm:text-sm">{raceModalMessage}</p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setRaceModalOpen(false);
                refetch();
              }}
            >
              Back to Pool
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
