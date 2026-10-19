'use client';

import React, { useState } from 'react';
import type { ExpiredStockItem } from '../types';
import { RemoveExpiredModal } from './RemoveExpiredModal';
import { Spinner } from '../../../components/ui/Spinner';

interface ExpiredStockTableProps {
  items: ExpiredStockItem[];
  isLoading: boolean;
}

export function ExpiredStockTable({ items, isLoading }: ExpiredStockTableProps) {
  const [selectedBatch, setSelectedBatch] = useState<ExpiredStockItem | null>(null);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Spinner size="lg" />
        <p className="text-xs text-slate-500 mt-2">Loading expired batches...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          ✓
        </div>
        <h4 className="text-sm font-semibold text-slate-800">No Expired Stock on Shelves</h4>
        <p className="text-xs text-slate-500 mt-1">There is no unsold inventory past its expiration date.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-rose-50/50 border-b border-rose-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Batch No</th>
                <th className="py-3 px-4">Expired On</th>
                <th className="py-3 px-4 text-center">Elapsed</th>
                <th className="py-3 px-4 text-right">Remaining Stock</th>
                <th className="py-3 px-4 text-right">MRP</th>
                <th className="py-3 px-4 text-center">Disposal Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.batchId} className="hover:bg-rose-50/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{item.medicineName}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{item.batchNumber}</td>
                  <td className="py-3 px-4 text-rose-600 font-medium">{item.expiryDate}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {item.daysExpired} {item.daysExpired === 1 ? 'day ago' : 'days ago'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700">{item.quantityOnHand} units</td>
                  <td className="py-3 px-4 text-right text-slate-600">₹{item.mrp}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedBatch(item)}
                      className="px-3 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors shadow-sm flex items-center gap-1 mx-auto"
                    >
                      Remove from Shelf
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RemoveExpiredModal
        batch={selectedBatch}
        isOpen={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
      />
    </>
  );
}
