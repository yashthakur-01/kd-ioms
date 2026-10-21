'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import {
  getInvoiceById,
  getInvoicePdfUrl,
  resendInvoiceNotification,
  type InvoiceDetail,
} from '../../lib/api/invoice.api';

interface InvoiceDetailModalProps {
  invoiceId: number | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function InvoiceDetailModal({
  invoiceId,
  isOpen,
  onClose,
  isAdmin = false,
}: InvoiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resending, setResending] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'EMAIL' | undefined>(undefined);

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      return;
    }
    let isMounted = true;
    getInvoiceById(invoiceId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setInvoice(res.data);
        } else {
          setError(res.message || 'Failed to load invoice');
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'An error occurred while loading invoice');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId]);

  async function loadInvoice(id: number) {
    try {
      setLoading(true);
      setError(null);
      const res = await getInvoiceById(id);
      if (res.success) {
        setInvoice(res.data);
      } else {
        setError(res.message || 'Failed to load invoice');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading invoice');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setInvoice(null);
    setError(null);
    setResendSuccess(null);
    onClose();
  }

  async function handleDownloadPdf() {
    if (!invoiceId) return;
    try {
      setDownloading(true);
      const res = await getInvoicePdfUrl(invoiceId);
      if (res.success && res.data.url) {
        const link = document.createElement('a');
        link.href = res.data.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleResend() {
    if (!invoiceId) return;
    try {
      setResending(true);
      setResendSuccess(null);
      const res = await resendInvoiceNotification(invoiceId, selectedChannel);
      if (res.success) {
        setResendSuccess('Notification queued successfully!');
        // Refresh invoice details to show new notification log entry
        await loadInvoice(invoiceId);
      }
    } catch (err: unknown) {
      alert(`Resend failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setResending(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={invoice ? `Invoice: ${invoice.invoiceNumber}` : 'Tax Invoice Details'}
      maxWidth="xl"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-slate-500">Loading invoice details...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          {error}
        </div>
      ) : invoice ? (
        <div className="space-y-6">
          {/* Top Bar: Order Reference & PDF Download */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs text-slate-500 font-medium">Order Reference:</span>
              <p className="text-sm font-bold text-slate-900">{invoice.orderNumber}</p>
              <span className="text-xs text-slate-400">
                Generated: {new Date(invoice.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="flex items-center gap-2"
              >
                {downloading ? <Spinner size="sm" /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                <span>Download PDF</span>
              </Button>
            </div>
          </div>

          {/* Billed To Card */}
          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To (Pharmacy)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{invoice.billedTo.shopName}</p>
                {invoice.billedTo.contactPerson && (
                  <p className="text-slate-600">Attn: {invoice.billedTo.contactPerson}</p>
                )}
                <p className="text-slate-600 mt-1">
                  {[invoice.billedTo.addressLine, invoice.billedTo.city, invoice.billedTo.state, invoice.billedTo.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
              <div className="space-y-1 text-slate-600">
                <p><span className="font-medium text-slate-800">Phone:</span> {invoice.billedTo.phone}</p>
                {invoice.billedTo.gstin && (
                  <p><span className="font-medium text-slate-800">GSTIN:</span> {invoice.billedTo.gstin}</p>
                )}
                {invoice.billedTo.drugLicenseNumber && (
                  <p><span className="font-medium text-slate-800">Drug License:</span> {invoice.billedTo.drugLicenseNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
              Accepted Line Items ({invoice.lines?.length || 0})
            </div>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold sticky top-0">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Medicine Description</th>
                    <th className="py-2 px-3">Batch</th>
                    <th className="py-2 px-3">Exp</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">MRP (₹)</th>
                    <th className="py-2 px-3 text-right">Rate (₹)</th>
                    <th className="py-2 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lines?.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {line.medicineName}
                        <span className="block text-[11px] text-slate-500">{line.packSize}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{line.batchNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{line.expiryDate}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">{line.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-600">₹{line.mrp}</td>
                      <td className="py-2 px-3 text-right text-slate-600">₹{line.unitPrice}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{line.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{invoice.subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Output GST (Single Line):</span>
                <span className="font-semibold text-slate-900">₹{invoice.gstAmount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Round Off:</span>
                <span className="font-semibold text-slate-900">₹{invoice.roundOff}</span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-emerald-700">₹{invoice.total}</span>
              </div>
            </div>
          </div>

          {/* Notification Timeline & Resend (Admin Only) */}
          {isAdmin && (
            <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dispatch & Notification Timeline
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                    className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-black !text-black"
                    value={selectedChannel || ''}
                    onChange={(e) => setSelectedChannel((e.target.value as 'WHATSAPP' | 'EMAIL') || undefined)}
                  >
                    <option value="">Cascade (WhatsApp → Email)</option>
                    <option value="WHATSAPP">WhatsApp Only</option>
                    <option value="EMAIL">Email Only</option>
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? <Spinner size="sm" /> : 'Resend'}
                  </Button>
                </div>
              </div>

              {resendSuccess && (
                <p className="text-xs text-emerald-600 font-medium">{resendSuccess}</p>
              )}

              {invoice.notifications && invoice.notifications.length > 0 ? (
                <div className="space-y-2">
                  {invoice.notifications.map((log) => (
                    <div
                      key={log.logId}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">{log.channel}</span>
                        <span className="text-slate-500">{log.recipient}</span>
                        <Badge
                          variant={
                            log.status === 'SENT'
                              ? 'success'
                              : log.status === 'FAILED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {log.status}
                        </Badge>
                      </div>
                      <div className="text-right text-slate-400 text-[11px]">
                        <span>Attempts: {log.attempts}</span>
                        {log.lastAttemptAt && (
                          <span className="ml-2">
                            {new Date(log.lastAttemptAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="block text-rose-600 font-medium">{log.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No notification dispatches logged yet.</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
