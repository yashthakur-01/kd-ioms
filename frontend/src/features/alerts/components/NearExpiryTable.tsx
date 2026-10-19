'use client';

import React from 'react';
import Link from 'next/link';
import type { NearExpiryAlertItem } from '../types';
import { useDismissNearExpiryMutation } from '../hooks';
import { Spinner } from '../../../components/ui/Spinner';

interface NearExpiryTableProps {
  items: NearExpiryAlertItem[];
  isLoading: boolean;
}

export function NearExpiryTable({ items, isLoading }: NearExpiryTableProps) {
  const dismissMutation = useDismissNearExpiryMutation();

  const handleDismiss = async (batchId: number) => {
    try {
      await dismissMutation.mutateAsync(batchId);
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Spinner size="lg" />
        <p className="text-xs text-slate-500 mt-2">Loading near-expiry batches...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          ✓
        </div>
        <h4 className="text-sm font-semibold text-slate-800">No Batches Nearing Expiry</h4>
        <p className="text-xs text-slate-500 mt-1">All active warehouse inventory is safely outside the alert threshold.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Medicine</th>
              <th className="py-3 px-4">Batch No</th>
              <th className="py-3 px-4">Expiry Date</th>
              <th className="py-3 px-4 text-center">Days Remaining</th>
              <th className="py-3 px-4 text-right">Available Stock</th>
              <th className="py-3 px-4 text-right">Selling Price</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const isUrgent = item.daysLeft <= 30;
              const isWarning = item.daysLeft <= 60;
              const isDismissing = dismissMutation.isPending && dismissMutation.variables === item.batchId;

              const badgeColor = isUrgent
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : isWarning
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-blue-100 text-blue-800 border-blue-200';

              return (
                <tr key={item.batchId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{item.medicineName}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{item.batchNumber}</td>
                  <td className="py-3 px-4 text-slate-600">{item.expiryDate}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                      {item.daysLeft} {item.daysLeft === 1 ? 'day' : 'days'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-800">{item.quantityOnHand} units</td>
                  <td className="py-3 px-4 text-right text-slate-600">₹{item.sellingPrice}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDismiss(item.batchId)}
                        disabled={isDismissing}
                        title="Keep as it is; dismiss alert until date passes"
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors flex items-center gap-1"
                      >
                        {isDismissing ? <Spinner size="sm" /> : null}
                        Keep (Dismiss)
                      </button>
                      <Link
                        href={`/batches/${item.batchId}`}
                        className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                      >
                        Adjust
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
