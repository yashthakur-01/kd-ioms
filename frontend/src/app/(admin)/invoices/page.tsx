'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { InvoiceDetailModal } from '@/components/invoices/InvoiceDetailModal';
import {
  getInvoices,
  getInvoicePdfUrl,
  type InvoiceListItem,
} from '@/lib/api/invoice.api';

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Detail Modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getInvoices({
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setInvoices(res.data);
          if (res.meta?.pagination) {
            setTotalPages(res.meta.pagination.totalPages || 1);
            setTotalItems(res.meta.pagination.totalItems || 0);
          } else {
            setTotalPages(1);
            setTotalItems(res.data.length);
          }
        } else {
          setError(res.message || 'Failed to fetch invoices');
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Error occurred while loading invoices');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [from, to, page, pageSize, refreshTrigger]);

  async function handleDownloadPdf(e: React.MouseEvent, invoiceId: number) {
    e.stopPropagation();
    try {
      setDownloadingId(invoiceId);
      const res = await getInvoicePdfUrl(invoiceId);
      if (res.success && res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (err: unknown) {
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingId(null);
    }
  }

  function handleRowClick(invoiceId: number) {
    setSelectedInvoiceId(invoiceId);
    setIsModalOpen(true);
  }

  function handleResetFilters() {
    setLoading(true);
    setFrom('');
    setTo('');
    setPage(1);
    setRefreshTrigger((prev) => prev + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesale Tax Invoices"
        description="Generated GST tax invoices for delivered pharmacy orders with notification audit trail."
      />

      {/* Filter Controls */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black !text-black"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black !text-black"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {(from || to) && (
            <div className="self-end">
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Clear Dates
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {invoices.length} of {totalItems} invoices
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Spinner size="lg" />
            <p className="mt-3 text-sm text-slate-500 font-medium">Loading invoices...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            {error}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <svg
              className="w-12 h-12 mx-auto text-slate-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-sm font-bold text-slate-700">No Invoices Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Delivered wholesale orders will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Invoice Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Pharmacy</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Output GST</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-center">Dispatch Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    onClick={() => handleRowClick(inv.invoiceId)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-emerald-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(inv.generatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {inv.orderNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {inv.shopName}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ₹{inv.subtotal}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ₹{inv.gstAmount}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{inv.total}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.latestNotification ? (
                        <Badge
                          variant={
                            inv.latestNotification.status === 'SENT'
                              ? 'success'
                              : inv.latestNotification.status === 'FAILED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {inv.latestNotification.channel} {inv.latestNotification.status}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Queued</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(inv.invoiceId);
                        }}
                      >
                        Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloadingId === inv.invoiceId}
                        onClick={(e) => handleDownloadPdf(e, inv.invoiceId)}
                      >
                        {downloadingId === inv.invoiceId ? (
                          <Spinner size="sm" />
                        ) : (
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={(p) => setPage(p)}
          />
        )}
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoiceId={selectedInvoiceId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInvoiceId(null);
        }}
        isAdmin={true}
      />
    </div>
  );
}
