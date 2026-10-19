'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api/client';
import { Spinner } from '../../../components/ui/Spinner';

interface MedicineRow {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  gstRate: number;
  availableStock?: number;
}

export function OutOfStockTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['medicines', 'out-of-stock'],
    queryFn: async () => {
      // Query medicines with pageSize 100
      const res = await apiFetch<MedicineRow[]>('/medicines', {
        query: { pageSize: 100, isActive: true },
      });
      // Filter medicines with 0 or undefined available stock
      return (res.data || []).filter((m) => !m.availableStock || m.availableStock <= 0);
    },
  });

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Spinner size="lg" />
        <p className="text-xs text-slate-500 mt-2">Checking warehouse stock availability...</p>
      </div>
    );
  }

  const items = data || [];

  if (items.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          ✓
        </div>
        <h4 className="text-sm font-semibold text-slate-800">All Medicines In Stock</h4>
        <p className="text-xs text-slate-500 mt-1">There are no active catalog items with zero stock availability.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Medicine Name</th>
              <th className="py-3 px-4">Manufacturer</th>
              <th className="py-3 px-4">Pack Size</th>
              <th className="py-3 px-4 text-center">GST Rate</th>
              <th className="py-3 px-4 text-center">Stock Status</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.medicineId} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                <td className="py-3 px-4 text-slate-600">{item.company}</td>
                <td className="py-3 px-4 text-slate-500">{item.packSize || 'N/A'}</td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">{item.gstRate}%</td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    Out of Stock
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <Link
                    href={`/stock/inward?medicineId=${item.medicineId}`}
                    className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-sm inline-flex items-center gap-1"
                  >
                    + Receive Stock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
