'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useBatches, useUpdateBatch } from '../../../features/batches/hooks';
import { BatchesTable } from '../../../features/batches/components/BatchesTable';
import { BatchAdjustModal } from '../../../features/batches/components/BatchAdjustModal';
import type { BatchRecord, ListBatchesParams } from '../../../features/batches/types';
import { Search, Plus, FileSpreadsheet, Filter } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';

export default function BatchesPage() {
  const [params, setParams] = useState<ListBatchesParams>({
    expiry: 'ALL',
    inStock: undefined,
    status: undefined,
    sort: 'expiryDate',
    page: 1,
    pageSize: 25,
    q: '',
  });

  const [selectedBatchForAdjust, setSelectedBatchForAdjust] = useState<BatchRecord | null>(null);

  const { data: response, isLoading } = useBatches(params);
  const updateBatchMutation = useUpdateBatch();

  const batches = response?.data || [];
  const meta = response?.meta as { pagination?: { totalItems: number; page: number; totalPages: number } } | undefined;
  const totalItems = meta?.pagination?.totalItems ?? 0;
  const totalPages = meta?.pagination?.totalPages ?? 1;

  const handleToggleStatus = async (batch: BatchRecord) => {
    const nextStatus = batch.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await updateBatchMutation.mutateAsync({
        batchId: batch.batchId,
        payload: { status: nextStatus },
      });
    } catch (err) {
      console.error('Failed to toggle batch status', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Batches Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor batch inventories, 90-day near-expiry thresholds, and perform stock adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/stock/ledger"
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" /> Stock Ledger
          </Link>
          <Link
            href="/stock/inward"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Inward Stock
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by batch number or medicine name..."
              value={params.q || ''}
              onChange={(e) => setParams((p) => ({ ...p, q: e.target.value, page: 1 }))}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Expiry Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-medium self-start md:self-auto">
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, expiry: 'ALL', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                params.expiry === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Batches
            </button>
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, expiry: 'NEAR', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                params.expiry === 'NEAR'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Near Expiry (≤90d)
            </button>
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, expiry: 'EXPIRED', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                params.expiry === 'EXPIRED'
                  ? 'bg-white text-red-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-red-700'
              }`}
            >
              Expired
            </button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">Filters:</span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={params.inStock === true}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  inStock: e.target.checked ? true : undefined,
                  page: 1,
                }))
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>In Stock Only</span>
          </label>

          <select
            value={params.status || ''}
            onChange={(e) =>
              setParams((p) => ({
                ...p,
                status: (e.target.value as 'ACTIVE' | 'BLOCKED') || undefined,
                page: 1,
              }))
            }
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="BLOCKED">Blocked Only</option>
          </select>

          <select
            value={params.sort || 'expiryDate'}
            onChange={(e) =>
              setParams((p) => ({
                ...p,
                sort: (e.target.value as ListBatchesParams['sort']) || undefined,
                page: 1,
              }))
            }
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white ml-auto"
          >
            <option value="expiryDate">Expiry (Earliest First)</option>
            <option value="-expiryDate">Expiry (Latest First)</option>
            <option value="-createdAt">Recently Added</option>
            <option value="batchNumber">Batch Number (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Table View */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
          <Spinner size="lg" />
          <p className="text-xs text-slate-400 mt-3 font-medium">Loading batch catalog...</p>
        </div>
      ) : (
        <>
          <BatchesTable
            batches={batches}
            onAdjust={(batch) => setSelectedBatchForAdjust(batch)}
            onToggleStatus={handleToggleStatus}
            isUpdatingStatus={updateBatchMutation.isPending}
          />

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-2">
              <span>
                Showing {batches.length} of {totalItems} batches
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
        </>
      )}

      {/* Stock Adjustment Modal */}
      <BatchAdjustModal
        batch={selectedBatchForAdjust}
        isOpen={Boolean(selectedBatchForAdjust)}
        onClose={() => setSelectedBatchForAdjust(null)}
      />
    </div>
  );
}
