'use client';

import React from 'react';
import Link from 'next/link';
import type { BatchRecord } from '../types';
import { Sliders, Clock, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

export interface BatchesTableProps {
  batches: BatchRecord[];
  onAdjust: (batch: BatchRecord) => void;
  onToggleStatus: (batch: BatchRecord) => void;
  isUpdatingStatus?: boolean;
}

export function BatchesTable({
  batches,
  onAdjust,
  onToggleStatus,
  isUpdatingStatus,
}: BatchesTableProps) {
  if (batches.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">No Batches Found</h3>
        <p className="text-xs text-slate-400 mt-1">
          Try adjusting your search query, expiry filter, or receive new stock via Stock Inward.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Medicine</th>
              <th className="py-3 px-4">Batch No</th>
              <th className="py-3 px-4">Expiry Date</th>
              <th className="py-3 px-4">MRP / Price (Incl. GST)</th>
              <th className="py-3 px-4 text-center">In Stock</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((batch) => {
              // Expiry badge calculation
              let expiryBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let expiryIcon = <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
              let expiryText = `${batch.daysLeft}d left`;

              if (batch.daysLeft < 0) {
                expiryBadgeClass = 'bg-red-50 text-red-700 border-red-200';
                expiryIcon = <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
                expiryText = `Expired (${Math.abs(batch.daysLeft)}d ago)`;
              } else if (batch.daysLeft <= 90) {
                expiryBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                expiryIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
                expiryText = `Expires in ${batch.daysLeft}d`;
              }

              return (
                <tr key={batch.batchId} className="hover:bg-slate-50/80 transition-colors">
                  {/* Medicine Info */}
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900">{batch.medicineName}</p>
                    <p className="text-[11px] text-slate-500">
                      {batch.medicineCompany} {batch.medicinePackSize ? `• ${batch.medicinePackSize}` : ''}
                    </p>
                  </td>

                  {/* Batch Number */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {batch.batchNumber}
                    </span>
                    {batch.gtin && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">GTIN: {batch.gtin}</p>
                    )}
                  </td>

                  {/* Expiry Date & Near-Expiry Badge */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-900">{batch.expiryDate}</div>
                    <div
                      className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${expiryBadgeClass}`}
                    >
                      {expiryIcon}
                      <span>{expiryText}</span>
                    </div>
                  </td>

                  {/* Pricing */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 font-mono">
                      ₹{batch.priceInclGst}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">incl. {batch.gstRate}%</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">MRP: ₹{batch.mrp}</div>
                  </td>

                  {/* Quantity */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-bold font-mono text-sm ${
                        batch.quantityOnHand === 0
                          ? 'text-slate-400'
                          : batch.quantityOnHand <= 10
                          ? 'text-amber-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {batch.quantityOnHand}
                    </span>
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => onToggleStatus(batch)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                        batch.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {batch.status}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAdjust(batch)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Sliders className="w-3.5 h-3.5" /> Adjust
                      </button>
                      <Link
                        href={`/batches/${batch.batchId}`}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Timeline"
                      >
                        <ExternalLink className="w-4 h-4" />
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
