'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RejectionModal } from '@/features/retailer/components/RejectionModal';
import {
  useRetailerDetail,
  useApproveRetailer,
  useRejectRetailer,
} from '@/features/retailer/hooks';
import type { ApprovalStatus } from '@/features/retailer/schema';

export default function AdminRetailerDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Spinner className="w-8 h-8 text-emerald-600" />
          <p className="text-sm font-medium text-slate-500">Loading retailer verification details...</p>
        </div>
      }
    >
      <RetailerDetailContent />
    </React.Suspense>
  );
}

function RetailerDetailContent() {
  const params = useParams();
  const userId = params?.userId as string;

  const { data: retailer, isLoading, isError, refetch } = useRetailerDetail(userId);
  const approveMutation = useApproveRetailer();
  const rejectMutation = useRejectRetailer();

  // Modals state
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (field: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleApproveConfirm = async () => {
    if (!userId) return;
    try {
      await approveMutation.mutateAsync(userId);
      setIsApproveOpen(false);
      refetch();
    } catch {
      // Error is caught by global handler / toast
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!userId) return;
    try {
      await rejectMutation.mutateAsync({ userId, reason });
      setIsRejectOpen(false);
      refetch();
    } catch {
      // Error is caught by global handler / toast
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner className="w-8 h-8 text-emerald-600" />
        <p className="text-sm font-medium text-slate-500">Loading retailer verification details...</p>
      </div>
    );
  }

  if (isError || !retailer) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Retailer Application Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested retailer profile could not be retrieved or does not exist.
        </p>
        <Link href="/retailers">
          <Button variant="outline" size="sm">
            Back to Retailer Queue
          </Button>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved &amp; Verified</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Application Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">Pending Compliance Review</Badge>;
    }
  };

  const isPending = retailer.approvalStatus === 'PENDING';

  return (
    <div className="space-y-6 pb-20">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/retailers"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          &larr; Back to Retailer Queue
        </Link>
      </div>

      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{retailer.shopName}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Linked User: <span className="font-semibold text-slate-700">{retailer.username}</span> |
            Account ID: <span className="font-mono">{retailer.userId}</span>
          </p>
        </div>
        <div>{getStatusBadge(retailer.approvalStatus)}</div>
      </div>

      {/* Rejection Remarks Callout if Rejected */}
      {retailer.approvalStatus === 'REJECTED' && (
        <div
          data-testid="detail-rejected-remarks"
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 space-y-1.5"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-semibold text-rose-950 text-sm">Application Rejection Remarks</h3>
          </div>
          <div className="bg-white/80 border border-rose-200/80 rounded-lg p-3 text-sm font-medium">
            {retailer.rejectionReason || 'No specific remarks recorded.'}
          </div>
          <p className="text-xs text-rose-700">
            The retailer has been notified of this reason and may update details to resubmit for review.
          </p>
        </div>
      )}

      {/* Detail Inspection Grid (D-12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pharmacy Establishment Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
            Pharmacy &amp; Establishment Details
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="block text-xs font-medium text-slate-500">Shop Name</span>
              <span className="font-semibold text-slate-900">{retailer.shopName}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">Street Address</span>
              <span className="text-slate-800">{retailer.addressLine}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-xs font-medium text-slate-500">City</span>
                <span className="text-slate-800">{retailer.city}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500">State</span>
                <span className="text-slate-800">{retailer.state}</span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">Postal Pincode</span>
              <span className="font-mono text-slate-900">{retailer.pincode}</span>
            </div>
          </div>
        </div>

        {/* Regulatory & Tax Credentials Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
            Licensing &amp; Tax Compliance
          </h2>

          <div className="space-y-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-slate-500 mb-1">Drug License Number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  {retailer.drugLicenseNumber}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('license', retailer.drugLicenseNumber)}
                  className="text-xs text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded px-2.5 py-1 transition-colors"
                >
                  {copiedField === 'license' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500 mb-1">GSTIN</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  {retailer.gstin || 'Not Provided'}
                </span>
                {retailer.gstin && (
                  <button
                    type="button"
                    onClick={() => handleCopy('gstin', retailer.gstin!)}
                    className="text-xs text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded px-2.5 py-1 transition-colors"
                  >
                    {copiedField === 'gstin' ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">WhatsApp Mobile Number</span>
              <span className="font-mono text-slate-800">{retailer.whatsappNumber}</span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500">Contact Email</span>
              <span className="text-slate-800">{retailer.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* Audit & Timestamps Card */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
            Application Audit &amp; Timestamps
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="block text-slate-400 font-medium">Applied On</span>
              <span className="text-slate-700 font-medium">
                {retailer.createdAt ? new Date(retailer.createdAt).toLocaleString() : '—'}
              </span>
            </div>

            <div>
              <span className="block text-slate-400 font-medium">Last Profile Update</span>
              <span className="text-slate-700 font-medium">
                {retailer.updatedAt ? new Date(retailer.updatedAt).toLocaleString() : '—'}
              </span>
            </div>

            <div>
              <span className="block text-slate-400 font-medium">Reviewed By</span>
              <span className="text-slate-700 font-mono">
                {retailer.reviewedBy || 'Pending Compliance Verification'}
              </span>
            </div>

            <div>
              <span className="block text-slate-400 font-medium">Reviewed At</span>
              <span className="text-slate-700 font-medium">
                {retailer.reviewedAt ? new Date(retailer.reviewedAt).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar for PENDING review (D-12) */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 shadow-lg z-30 sm:pl-64">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 block">Current Application Status:</span>
            <span className="text-sm font-semibold text-slate-900">{retailer.approvalStatus}</span>
          </div>

          <div className="flex items-center gap-3">
            {isPending ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => setIsRejectOpen(true)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                >
                  Reject Application
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setIsApproveOpen(true)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Approve Application
                </Button>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-medium bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                Application Review Complete ({retailer.approvalStatus})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Approval Confirm Dialog (D-11) */}
      <ConfirmDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Retailer Application"
        message={`Confirm approval for ${retailer.shopName} (Drug License: ${retailer.drugLicenseNumber}, GSTIN: ${retailer.gstin || 'N/A'})? This will immediately unlock catalog ordering permissions.`}
        confirmLabel="Confirm Approval"
        variant="primary"
        isLoading={approveMutation.isPending}
      />

      {/* Rejection Modal with presets & live counter (D-10) */}
      <RejectionModal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={handleRejectConfirm}
        isLoading={rejectMutation.isPending}
        shopName={retailer.shopName}
      />
    </div>
  );
}
