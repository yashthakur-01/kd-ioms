'use client';

import React from 'react';
import Link from 'next/link';
import type { DashboardSummaryData } from '../types';

interface DashboardSummaryCardsProps {
  summary: DashboardSummaryData | null;
  isLoading: boolean;
}

export function DashboardSummaryCards({ summary, isLoading }: DashboardSummaryCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-5 bg-white rounded-xl border border-slate-200 animate-pulse space-y-3">
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-2 bg-slate-100 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Pending Retailers',
      count: summary.pendingRetailers,
      subtitle: 'Awaiting KYC Verification',
      href: '/retailers',
      badgeColor: summary.pendingRetailers > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600',
      actionText: 'Review Queue',
      isWarning: summary.pendingRetailers > 0,
    },
    {
      title: 'Placed Orders',
      count: summary.placedOrders,
      subtitle: 'Awaiting Review & Approval',
      href: '/orders',
      badgeColor: summary.placedOrders > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600',
      actionText: 'View Orders',
    },
    {
      title: 'Approved (Unclaimed)',
      count: summary.approvedUnclaimed,
      subtitle: 'Ready for Picking',
      href: '/orders',
      badgeColor: summary.approvedUnclaimed > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600',
      actionText: 'Order Queue',
    },
    {
      title: 'Out for Delivery',
      count: summary.outForDelivery,
      subtitle: 'Dispatches in Transit',
      href: '/orders',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      actionText: 'Track Shipments',
    },
    {
      title: 'Near Expiry Batches',
      count: summary.nearExpiryBatches,
      subtitle: 'Within Alert Window',
      href: '/alerts?tab=near-expiry',
      badgeColor: summary.nearExpiryBatches > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600',
      actionText: 'Check Batches',
      isWarning: summary.nearExpiryBatches > 0,
    },
    {
      title: 'Expired Stock',
      count: summary.expiredBatches,
      subtitle: 'Unsold Past Expiry',
      href: '/alerts?tab=expired',
      badgeColor: summary.expiredBatches > 0 ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-600',
      actionText: 'Write Off',
      isDestructive: summary.expiredBatches > 0,
    },
    {
      title: 'Out of Stock Medicines',
      count: summary.outOfStockMedicines,
      subtitle: 'Zero Availability in Catalog',
      href: '/alerts?tab=out-of-stock',
      badgeColor: summary.outOfStockMedicines > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600',
      actionText: 'Receive Stock',
      isDestructive: summary.outOfStockMedicines > 0,
    },
    {
      title: 'Failed Notifications',
      count: summary.failedNotifications,
      subtitle: 'Requires Intervention',
      href: '/settings',
      badgeColor: summary.failedNotifications > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600',
      actionText: 'View Settings',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Link
          key={c.title}
          href={c.href}
          className={`block p-5 bg-white rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
            c.isDestructive
              ? 'border-rose-200 hover:border-rose-300'
              : c.isWarning
              ? 'border-amber-200 hover:border-amber-300'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
              {c.title}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeColor}`}>
              {c.count}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${
              c.isDestructive ? 'text-rose-600' : c.isWarning ? 'text-amber-600' : 'text-slate-900'
            }`}>
              {c.count}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mt-1 truncate">{c.subtitle}</p>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            <span>{c.actionText}</span>
            <span>→</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
