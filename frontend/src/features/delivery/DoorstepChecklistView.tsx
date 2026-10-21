'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  RotateCw,
  Undo2,
  Info,
  Calendar,
} from 'lucide-react';
import {
  useDeliveryOrderDetail,
  useCompleteDelivery,
  useReleaseDelivery,
} from './hooks/useDelivery';
import { useToast } from '@/providers/ToastProvider';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface DoorstepChecklistViewProps {
  orderId: number;
}

const PRESET_REFUSAL_REASONS = [
  'Packaging torn / seal broken',
  'Wrong medicine delivered',
  'Pharmacy refused order',
  'Near expiry batch',
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DoorstepChecklistView({ orderId }: DoorstepChecklistViewProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: order, isLoading, error, refetch, isRefetching } = useDeliveryOrderDetail(orderId);
  const completeMutation = useCompleteDelivery();
  const releaseMutation = useReleaseDelivery();

  // State for line decisions: orderItemId -> { decision: 'ACCEPTED' | 'REFUSED', reason: string }
  const [decisions, setDecisions] = useState<
    Record<number, { decision: 'ACCEPTED' | 'REFUSED'; reason: string }>
  >({});

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Address copied state
  const [isCopied, setIsCopied] = useState(false);

  // Enlarged photo preview modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Release modal
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-400">
        <Spinner size="lg" />
        <p className="mt-3 text-sm font-semibold">Loading doorstep order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Order Not Found</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
          This order might not be assigned to you or could have been returned to the dispatch pool.
        </p>
        <Link
          href="/delivery/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deliveries
        </Link>
      </div>
    );
  }

  const isOutForDelivery = order.status === 'OUT_FOR_DELIVERY';
  const isDelivered = order.status === 'DELIVERED';

  const fullAddress = [
    order.retailer.addressLine,
    order.retailer.city,
    order.retailer.state,
    order.retailer.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setIsCopied(true);
      showSuccess('Address copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showError('Failed to copy address');
    }
  };

  const handleSetDecision = (orderItemId: number, decision: 'ACCEPTED' | 'REFUSED') => {
    setDecisions((prev) => {
      const existing = prev[orderItemId] || { decision, reason: '' };
      return {
        ...prev,
        [orderItemId]: {
          ...existing,
          decision,
          // Clear reason if toggled to ACCEPTED
          reason: decision === 'ACCEPTED' ? '' : existing.reason,
        },
      };
    });
  };

  const handleSetReason = (orderItemId: number, reason: string) => {
    setDecisions((prev) => ({
      ...prev,
      [orderItemId]: {
        decision: 'REFUSED',
        reason,
      },
    }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      showError('Photo exceeds 5MB limit. Please take a standard compressed photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmRelease = async () => {
    try {
      await releaseMutation.mutateAsync({
        orderId: order.orderId,
        reason: releaseReason.trim() || undefined,
      });
      setIsReleaseModalOpen(false);
      router.push('/delivery/orders');
    } catch {
      // Handled by toast in hook
    }
  };

  // Submission validation
  const totalItems = order.items.length;
  let decidedCount = 0;
  let acceptedCount = 0;
  let refusedCount = 0;
  let hasInvalidRefusalReason = false;

  for (const item of order.items) {
    const d = decisions[item.orderItemId];
    if (d?.decision === 'ACCEPTED') {
      decidedCount++;
      acceptedCount++;
    } else if (d?.decision === 'REFUSED') {
      decidedCount++;
      refusedCount++;
      if (!d.reason || d.reason.trim().length < 3 || d.reason.length > 200) {
        hasInvalidRefusalReason = true;
      }
    }
  }

  const allItemsDecided = decidedCount === totalItems;
  const isSubmitValid =
    isOutForDelivery &&
    Boolean(photoFile) &&
    allItemsDecided &&
    !hasInvalidRefusalReason &&
    !completeMutation.isPending;

  const handleSubmitDelivery = async () => {
    if (!photoFile) {
      showError('Please capture delivery photo proof before completing.');
      return;
    }

    if (!allItemsDecided) {
      showError('Please record acceptance or refusal for every item.');
      return;
    }

    if (hasInvalidRefusalReason) {
      showError('Please provide a valid reason (3-200 characters) for every refused item.');
      return;
    }

    const payloadDecisions = order.items.map((item) => {
      const d = decisions[item.orderItemId];
      return {
        orderItemId: item.orderItemId,
        decision: d.decision,
        reason: d.decision === 'REFUSED' ? d.reason.trim() : undefined,
      };
    });

    try {
      const res = await completeMutation.mutateAsync({
        orderId: order.orderId,
        payload: {
          photo: photoFile,
          decisions: payloadDecisions,
        },
      });

      refetch();
      if (res.data.status === 'DELIVERED') {
        showSuccess(`Order #${order.orderNumber} delivered successfully!`);
      } else {
        showSuccess(`Order #${order.orderNumber} rejected at doorstep.`);
      }
    } catch {
      // Handled by toast in hook
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/delivery/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              My Deliveries
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {order.orderNumber}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Doorstep Verification
            </h1>
            {isOutForDelivery ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Out For Delivery
              </span>
            ) : isDelivered ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Delivered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                <XCircle className="w-3.5 h-3.5" />
                Refused at Doorstep
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOutForDelivery && (
            <button
              type="button"
              onClick={() => setIsReleaseModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors min-h-[44px]"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Release to Pool
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Completion Banner if DELIVERED or REJECTED */}
      {!isOutForDelivery && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
            isDelivered
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          {isDelivered ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          )}
          <div className="text-xs sm:text-sm space-y-0.5">
            <p className="font-bold">
              {isDelivered
                ? 'Delivery Completed'
                : 'Order Refused by Retailer'}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Completed on {formatDateTime(order.deliveredAt)}
              {order.deliveryPartner && ` by ${order.deliveryPartner.username}`}.
            </p>
            {order.rejectionReason && (
              <p className="mt-1 font-semibold text-rose-700 dark:text-rose-300">
                Reason: {order.rejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pharmacy Destination Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                {order.retailer.shopName || order.retailer.pharmacyName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Licensed Wholesale Retailer
              </p>
            </div>
          </div>

          {/* Quick Communication Actions */}
          <div className="flex items-center gap-2">
            {order.retailer.phone && (
              <a
                href={`tel:${order.retailer.phone}`}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors min-h-[44px]"
              >
                <Phone className="w-3.5 h-3.5" />
                Call ({order.retailer.phone})
              </a>
            )}

            {order.retailer.whatsappNumber && (
              <a
                href={`https://wa.me/${order.retailer.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-xs font-bold shadow-sm transition-colors min-h-[44px]"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Address and Map Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {fullAddress || 'Address on file'}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors min-h-[36px]"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  Copy Address
                </>
              )}
            </button>

            {fullAddress && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  fullAddress
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors min-h-[36px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Directions (Google Maps)
              </a>
            )}
          </div>
        </div>

        {order.note && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Customer Note:</strong> {order.note}
            </span>
          </div>
        )}
      </div>

      {/* Item Checklist */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Medicine Checklist ({order.items.length} lines)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verify whole-line packages with retailer at handover.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Total ₹{order.totalAmount}
          </span>
        </div>

        <div className="space-y-4">
          {order.items.map((item) => {
            const currentDecision = decisions[item.orderItemId]?.decision;
            const currentReason = decisions[item.orderItemId]?.reason || '';

            // If order already completed, display historical decision
            const finalStatus = item.deliveryStatus;

            return (
              <div
                key={item.orderItemId}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                {/* Item Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.medicineName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.company} • {item.packSize}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      ₹{item.quotedPriceInclGst} / unit
                    </span>
                    <span className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Handover: {item.pickedQuantity} units
                    </span>
                  </div>
                </div>

                {/* Batch Allocations Pill */}
                {item.allocations && item.allocations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                      Allocated Batches:
                    </span>
                    {item.allocations.map((alloc) => (
                      <span
                        key={alloc.allocationId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
                      >
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {alloc.batchNumber} (Exp: {alloc.expiryDate}) • Qty: {alloc.quantity}
                      </span>
                    ))}
                  </div>
                )}

                {/* Decision Actions */}
                {isOutForDelivery ? (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSetDecision(item.orderItemId, 'ACCEPTED')}
                        className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          currentDecision === 'ACCEPTED'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Accept Full ({item.pickedQuantity})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDecision(item.orderItemId, 'REFUSED')}
                        className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          currentDecision === 'REFUSED'
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-rose-500'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        Refuse Full ({item.pickedQuantity})
                      </button>
                    </div>

                    {/* Refusal Reason Section */}
                    {currentDecision === 'REFUSED' && (
                      <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                        <label className="block text-xs font-bold text-rose-900 dark:text-rose-200">
                          Refusal Reason <span className="text-rose-600">*</span>
                        </label>

                        {/* Preset tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_REFUSAL_REASONS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSetReason(item.orderItemId, preset)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                currentReason === preset
                                  ? 'bg-rose-600 border-rose-600 text-white font-bold'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-rose-300'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* Textarea */}
                        <textarea
                          rows={2}
                          value={currentReason}
                          onChange={(e) => handleSetReason(item.orderItemId, e.target.value)}
                          placeholder="Provide specific details (minimum 3 characters)..."
                          maxLength={200}
                          style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                          className="w-full text-xs p-2.5 rounded-lg border border-rose-300 bg-white text-black !text-black focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                          <span>
                            {currentReason.trim().length < 3 && (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                Minimum 3 characters required
                              </span>
                            )}
                          </span>
                          <span>{currentReason.length}/200</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Completed Order Read-Only Badge */
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Final Outcome:</span>
                    {finalStatus === 'ACCEPTED' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accepted ({item.pickedQuantity} units)
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" />
                          Refused (Returned to Stock)
                        </span>
                        {item.refusalReason && (
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Reason: {item.refusalReason}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Camera Delivery Proof Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" />
              Delivery Proof Photo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clear photo of items at pharmacy counter with signature or store board.
            </p>
          </div>
          {isOutForDelivery && photoFile && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
              Photo Attached
            </span>
          )}
        </div>

        {/* Existing Proof (For Completed Orders) */}
        {!isOutForDelivery && order.deliveryPhotoPath && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.deliveryPhotoPath}
                alt="Delivery proof"
                className="w-full h-48 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => setIsPhotoModalOpen(true)}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Enlarge Proof Photo
            </button>
          </div>
        )}

        {/* New Photo Upload (For Active Orders) */}
        {isOutForDelivery && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {!photoPreviewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[56px] border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/30 transition-all p-4"
              >
                <Camera className="w-5 h-5 text-emerald-600" />
                Take Delivery Photo
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreviewUrl}
                    alt="Captured proof"
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => setIsPhotoModalOpen(true)}
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center justify-between">
                    <span className="truncate">{photoFile?.name}</span>
                    <span className="shrink-0 font-bold">
                      {photoFile ? `${(photoFile.size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[44px]"
                  >
                    Retake Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold min-h-[44px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Summary & Submission Bar (When OUT_FOR_DELIVERY) */}
      {isOutForDelivery && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-xl z-40">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <span>
                  {decidedCount} of {totalItems} items verified
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {acceptedCount} Accept
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-rose-600 dark:text-rose-400">
                  {refusedCount} Refused
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {!photoFile
                  ? 'Delivery photo proof required'
                  : !allItemsDecided
                  ? 'Pending decisions on remaining items'
                  : hasInvalidRefusalReason
                  ? 'Reason required for refused items'
                  : refusedCount === totalItems
                  ? 'Outcome: REJECTED (All items refused at doorstep)'
                  : refusedCount > 0
                  ? 'Outcome: DELIVERED (Partial handover, refused stock returned)'
                  : 'Outcome: DELIVERED (Full order accepted)'}
              </p>
            </div>

            <Button
              variant={refusedCount === totalItems ? 'danger' : 'primary'}
              onClick={handleSubmitDelivery}
              disabled={!isSubmitValid}
              isLoading={completeMutation.isPending}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {refusedCount === totalItems ? 'Confirm Refusal' : 'Complete Delivery'}
            </Button>
          </div>
        </div>
      )}

      {/* Enlarged Photo Modal */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        title="Delivery Proof Photo"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPreviewUrl || order.deliveryPhotoPath || ''}
            alt="Delivery proof enlarged"
            className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950"
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsPhotoModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Release to Pool Confirmation Modal */}
      <Modal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        title="Release Order to Dispatch Pool"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold">Return Order #{order.orderNumber} to Dispatch Pool?</p>
              <p className="text-slate-600 dark:text-slate-400">
                You will be unassigned from this order so another delivery partner can pick it up.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="release-reason-field"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Reason for release (optional)
            </label>
            <input
              id="release-reason-field"
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="e.g. Vehicle issue, shop unreachable, closing time"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-black !text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsReleaseModalOpen(false)}
              disabled={releaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRelease}
              isLoading={releaseMutation.isPending}
            >
              Confirm Release
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
