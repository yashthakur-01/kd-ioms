'use client';

import React from 'react';
import { CheckCircle2, Clock, Truck, PackageCheck, XCircle, AlertCircle } from 'lucide-react';
import type { OrderStatus } from '../../lib/enums/order-status.enum';
import type { OrderStatusHistoryItem } from '../../lib/api/orders.api';

export interface OrderTimelineProps {
  currentStatus: OrderStatus;
  history?: OrderStatusHistoryItem[];
  cancelledAt?: string | null;
  rejectionReason?: string | null;
}

interface StepConfig {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LINEAR_STEPS: StepConfig[] = [
  {
    status: 'PLACED',
    label: 'Order Placed',
    description: 'Inventory reserved, awaiting warehouse verification',
    icon: Clock,
  },
  {
    status: 'APPROVED',
    label: 'Approved & Packed',
    description: 'Batches allocated and packed for dispatch',
    icon: CheckCircle2,
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    description: 'Dispatched with delivery partner',
    icon: Truck,
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    description: 'Handover complete with proof of delivery',
    icon: PackageCheck,
  },
];

export function OrderTimeline({ currentStatus, history = [], cancelledAt, rejectionReason }: OrderTimelineProps) {
  const isTerminalFailure = currentStatus === 'CANCELLED' || currentStatus === 'REJECTED';

  // Map history by to_status to find timestamps
  const historyMap = React.useMemo(() => {
    const map = new Map<string, OrderStatusHistoryItem>();
    for (const h of history) {
      map.set(h.toStatus, h);
    }
    return map;
  }, [history]);

  const getStepState = (stepStatus: OrderStatus) => {
    if (isTerminalFailure) {
      if (stepStatus === 'PLACED') return 'completed';
      return 'omitted';
    }

    const orderHierarchy: OrderStatus[] = ['PLACED', 'APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIndex = orderHierarchy.indexOf(currentStatus);
    const stepIndex = orderHierarchy.indexOf(stepStatus);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Order Lifecycle Status</h2>

      <div className="relative">
        <div className="space-y-8 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {LINEAR_STEPS.map((step) => {
            const state = getStepState(step.status);
            if (state === 'omitted') return null;

            const hist = historyMap.get(step.status);
            const Icon = step.icon;

            return (
              <div key={step.status} className="relative flex items-start gap-4">
                {/* Status Dot / Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors shadow-sm ${
                    state === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : state === 'current'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h3
                      className={`text-sm font-bold ${
                        state === 'completed' || state === 'current'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {step.label}
                    </h3>
                    {(hist?.createdAt || (step.status === 'PLACED' && history[0]?.createdAt)) && (
                      <span className="text-xs text-slate-400 font-medium">
                        {formatTimestamp(hist?.createdAt || history[0]?.createdAt)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {hist?.note || step.description}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Terminal Cancellation / Rejection Branch */}
          {currentStatus === 'CANCELLED' && (
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 z-10 shadow-sm ring-4 ring-rose-500/20">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 pt-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    Order Cancelled
                  </h3>
                  {cancelledAt && (
                    <span className="text-xs text-slate-400 font-medium">
                      {formatTimestamp(cancelledAt)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {rejectionReason || historyMap.get('CANCELLED')?.note || 'Cancelled by retailer. Inventory reservations released.'}
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'REJECTED' && (
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 z-10 shadow-sm ring-4 ring-rose-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 pt-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    Order Rejected
                  </h3>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {rejectionReason || historyMap.get('REJECTED')?.note || 'Order could not be fulfilled by warehouse.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
