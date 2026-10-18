'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBatch } from '../../../../features/batches/hooks';
import { BatchAdjustModal } from '../../../../features/batches/components/BatchAdjustModal';
import { ArrowLeft, Sliders, AlertTriangle, User, History } from 'lucide-react';
import { Spinner } from '../../../../components/ui/Spinner';

function BatchDetailContent() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = Number(params?.batchId);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const { data: detail, isLoading, error } = useBatch(batchId);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-xs text-slate-400 mt-3 font-medium">Loading batch timeline...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Batch Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          The requested batch could not be found or has been removed.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { batch, ledgerEntries } = detail;
  const isExpired = batch.daysLeft < 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/batches" className="hover:text-indigo-600 flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> Batches
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-mono font-semibold">{batch.batchNumber}</span>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold uppercase bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">
                Batch #{batch.batchNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  batch.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {batch.status}
              </span>
              {batch.daysLeft <= 90 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isExpired
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isExpired ? 'Expired' : `Expires in ${batch.daysLeft}d`}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{batch.medicineName}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {batch.medicineCompany} {batch.medicinePackSize ? `• ${batch.medicinePackSize}` : ''} • GST: {batch.gstRate}%
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Sliders className="w-4 h-4" /> Adjust Stock
            </button>
          </div>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-slate-400">Current Stock</span>
            <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
              {batch.quantityOnHand} units
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-slate-400">Expiry Date</span>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{batch.expiryDate}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-slate-400">Price (incl. GST)</span>
            <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">₹{batch.priceInclGst}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-slate-400">MRP</span>
            <p className="text-sm font-semibold font-mono text-slate-600 mt-0.5">₹{batch.mrp}</p>
          </div>
        </div>
      </div>

      {/* Movement Audit Trail / Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Stock Ledger Audit Timeline</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Last 20 Movements</span>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No movements recorded for this batch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Delta</th>
                  <th className="py-2.5 px-4 text-right">Balance After</th>
                  <th className="py-2.5 px-4">Reason / Notes</th>
                  <th className="py-2.5 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerEntries.map((entry) => {
                  const isPositive = entry.delta > 0;
                  return (
                    <tr key={entry.entryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.type === 'INWARD' || entry.type === 'RESTOCK' || entry.type === 'RETURN_IN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.type === 'OUTWARD'
                              ? 'bg-blue-100 text-blue-800'
                              : entry.type === 'EXPIRY_WRITEOFF'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                          {isPositive ? `+${entry.delta}` : entry.delta}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {entry.balanceAfter}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {entry.reason || entry.supplierName || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.createdByName || entry.createdByUsername || 'System'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      <BatchAdjustModal
        batch={batch}
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
      />
    </div>
  );
}

export default function BatchDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
          <Spinner size="lg" />
          <p className="text-xs text-slate-400 mt-3 font-medium">Loading batch timeline...</p>
        </div>
      }
    >
      <BatchDetailContent />
    </React.Suspense>
  );
}

