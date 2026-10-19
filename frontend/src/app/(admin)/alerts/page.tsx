'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertTriangle, PlusCircle, CheckCircle2 } from 'lucide-react';

interface OutOfStockAlertItem {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  saltsText: string;
  gstRate: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  maxMrp: string | null;
}

export default function AdminAlertsPage() {
  const [activeTab, setActiveTab] = useState<'out-of-stock' | 'near-expiry' | 'expired'>('out-of-stock');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['alerts', 'out-of-stock', page, pageSize],
    queryFn: () =>
      apiFetch<OutOfStockAlertItem[]>('/alerts/out-of-stock', {
        query: { page, pageSize },
      }),
    enabled: activeTab === 'out-of-stock',
  });

  const alerts = data?.data || [];
  const pagination = data?.meta?.pagination;
  const totalItems = pagination?.totalItems || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Alerts & Shortfalls"
        description="Monitor warehouse zero-stock medicines, near-expiry batches, and physical inventory bottlenecks"
      />

      {/* Operational Tab Strip */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('out-of-stock')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm inline-flex items-center gap-2 transition-all ${
              activeTab === 'out-of-stock'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Out of Stock</span>
            {totalItems > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {totalItems}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('near-expiry')}
            className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-all opacity-70 cursor-not-allowed ${
              activeTab === 'near-expiry'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-400'
            }`}
          >
            <span>Near Expiry</span>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              Phase 10
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expired')}
            className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-all opacity-70 cursor-not-allowed ${
              activeTab === 'expired'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-400'
            }`}
          >
            <span>Expired Stock</span>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              Phase 10
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'out-of-stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 animate-pulse text-sm">
              Loading inventory alerts...
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-rose-600 text-sm">
              Failed to load out-of-stock alerts. Please refresh or try again later.
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                icon={<CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />}
                title="All Medicines In Stock"
                description="Zero stock shortfalls detected! Every active medicine in your master catalog has sellable inventory."
              />
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine / Company</TableHead>
                    <TableHead>Pack Size & Composition</TableHead>
                    <TableHead>On-Hand</TableHead>
                    <TableHead>Reserved (Placed)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max MRP</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((item) => (
                    <TableRow key={item.medicineId} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.company}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-700">{item.packSize}</div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate" title={item.saltsText}>
                          {item.saltsText || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-700">{item.onHandQty}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-amber-600">{item.reservedQty}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          0 Available
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-slate-700">
                          {item.maxMrp ? `₹${item.maxMrp}` : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/stock/inward?medicineId=${item.medicineId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Inward Stock</span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalItems > pageSize && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
