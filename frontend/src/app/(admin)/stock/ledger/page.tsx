'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStockLedger } from '../../../../features/batches/hooks';
import type { ListLedgerParams } from '../../../../features/batches/types';
import { ArrowLeft, FileSpreadsheet, User, Filter, Calendar } from 'lucide-react';
import { Spinner } from '../../../../components/ui/Spinner';

export default function StockLedgerPage() {
  const [params, setParams] = useState<ListLedgerParams>({
    page: 1,
    pageSize: 25,
  });

  const { data: response, isLoading } = useStockLedger(params);
  const rows = response?.data || [];
  const meta = response?.meta as { pagination?: { totalItems: number; page: number; totalPages: number } } | undefined;
  const totalItems = meta?.pagination?.totalItems ?? 0;
  const totalPages = meta?.pagination?.totalPages ?? 1;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/batches" className="hover:text-indigo-600 flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> Batches
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">Stock Ledger</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Append-Only Stock Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete platform audit trail of all physical stock movements, inward top-ups, write-offs, and adjustments.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Movement Type Filter */}
        <select
          value={params.type || ''}
          onChange={(e) =>
            setParams((p) => ({
              ...p,
              type: e.target.value || undefined,
              page: 1,
            }))
          }
          style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-black !text-black focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Movement Types</option>
          <option value="INWARD">INWARD</option>
          <option value="RESTOCK">RESTOCK</option>
          <option value="RETURN_IN">RETURN_IN</option>
          <option value="OUTWARD">OUTWARD</option>
          <option value="DAMAGE">DAMAGE</option>
          <option value="EXPIRY_WRITEOFF">EXPIRY_WRITEOFF</option>
          <option value="CORRECTION">CORRECTION</option>
        </select>

        {/* Date Range: From */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">From:</span>
          <input
            type="date"
            value={params.from || ''}
            onChange={(e) =>
              setParams((p) => ({
                ...p,
                from: e.target.value || undefined,
                page: 1,
              }))
            }
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-black !text-black"
          />
        </div>

        {/* Date Range: To */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">To:</span>
          <input
            type="date"
            value={params.to || ''}
            onChange={(e) =>
              setParams((p) => ({
                ...p,
                to: e.target.value || undefined,
                page: 1,
              }))
            }
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-black !text-black"
          />
        </div>

        {/* Reset Filters */}
        {(params.type || params.from || params.to) && (
          <button
            type="button"
            onClick={() => setParams({ page: 1, pageSize: 25 })}
            className="text-xs text-indigo-600 hover:underline font-semibold ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Ledger Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
          <Spinner size="lg" />
          <p className="text-xs text-slate-400 mt-3 font-medium">Loading ledger movements...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Ledger Entries Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try clearing your filters or recording stock movements.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                  <th className="py-3 px-4">Reason / Notes / Ref</th>
                  <th className="py-3 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const isPositive = row.delta > 0;
                  return (
                    <tr key={row.entryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{row.medicineName}</p>
                        <p className="text-[11px] text-slate-400">{row.medicineCompany}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/batches/${row.batchId}`}
                          className="font-mono font-semibold text-indigo-600 hover:underline"
                        >
                          {row.batchNumber}
                        </Link>
                        <p className="text-[10px] text-slate-400">Exp: {row.expiryDate}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.type === 'INWARD' || row.type === 'RESTOCK' || row.type === 'RETURN_IN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.type === 'OUTWARD'
                              ? 'bg-blue-100 text-blue-800'
                              : row.type === 'EXPIRY_WRITEOFF'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                          {isPositive ? `+${row.delta}` : row.delta}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {row.balanceAfter}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {row.reason || row.supplierName || (row.orderId ? `Order #${row.orderId}` : '—')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{row.createdByName || row.createdByUsername || 'System'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {rows.length} of {totalItems} movements
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={params.page === 1}
                  onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) - 1 }))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-semibold text-slate-700">
                  {params.page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={params.page === totalPages}
                  onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) + 1 }))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
