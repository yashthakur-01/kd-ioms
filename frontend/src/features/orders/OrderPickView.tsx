'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Ban,
  Loader2,
  Scan,
} from 'lucide-react';
import { useOrderPicking } from './hooks/useOrderPicking';
import { OrderItemPickCard } from './components/OrderItemPickCard';
import { OrderRejectModal } from './components/OrderRejectModal';
import { BarcodeScanListener } from './components/BarcodeScanListener';
import { OrderBatchScannerModal } from './components/OrderBatchScannerModal';
import type { BatchPickSuggestion } from '../../lib/api/orders.api';

export interface OrderPickViewProps {
  orderId: number;
}

export function OrderPickView({ orderId }: OrderPickViewProps) {
  const {
    suggestions,
    allocations,
    isLoading,
    isError,
    error,
    stats,
    highlightedItemId,
    applyAllSuggestions,
    applyBatchSuggestion,
    updateAllocationQuantity,
    removeAllocation,
    addAllocation,
    handleScanMatch,
    approveOrder,
    isApproving,
    rejectOrder,
    isRejecting,
  } = useOrderPicking(orderId);

  // Modals state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerTargetMedicineId, setScannerTargetMedicineId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading order batches and FEFO suggestions...</p>
      </div>
    );
  }

  if (isError || !suggestions) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900/60">
          <Ban className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Order Not Ready for Picking</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {error instanceof Error ? error.message : 'This order does not exist or is not in PLACED status.'}
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders Queue
        </Link>
      </div>
    );
  }

  const handleApplySuggestion = (item: (typeof suggestions.items)[0], batch: BatchPickSuggestion) => {
    applyBatchSuggestion(item.orderItemId, batch, item.requestedQuantity);
  };

  const handleManualBatchSelect = (item: (typeof suggestions.items)[0], batch: BatchPickSuggestion) => {
    addAllocation(item.orderItemId, batch, Math.min(batch.quantityOnHand, item.requestedQuantity), 'MANUAL');
  };

  const handleHardwareScan = async (code: string) => {
    await handleScanMatch(code, undefined, 'SCAN_GUN');
  };

  const percentComplete = stats.totalRequested > 0
    ? Math.round((stats.totalPicked / stats.totalRequested) * 100)
    : 0;

  const shortfallToDrop = Math.max(0, stats.totalRequested - stats.totalPicked);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Hardware Barcode Scanner Listener */}
      <BarcodeScanListener onScan={handleHardwareScan} />

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Order Summary
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Pick & Approve Order {suggestions.orderNumber}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              PLACED
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setScannerTargetMedicineId(null);
              setIsScannerModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-all shadow-sm"
          >
            <Scan className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Scan & Deduct Batch</span>
          </button>

          <button
            type="button"
            onClick={applyAllSuggestions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Apply All FEFO</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRejectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-all shadow-sm"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Reject Order</span>
          </button>

          <button
            type="button"
            disabled={stats.totalPicked === 0 || isApproving}
            onClick={() => approveOrder()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-600/20"
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Approve Order ({stats.totalPicked}/{stats.totalRequested})</span>
          </button>
        </div>
      </div>

      {/* Fulfillment Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Picking & Allocation Progress
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.fullLines} of {stats.totalLines} lines completely filled
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {stats.fullLines} Full
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              {stats.partialLines} Partial
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              {stats.noneLines} None
            </span>
            {shortfallToDrop > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-bold">
                -{shortfallToDrop} Dropped
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Order Item Pick Cards List */}
      <div className="space-y-4">
        {suggestions.items.map((item) => (
          <OrderItemPickCard
            key={item.orderItemId}
            item={item}
            allocations={allocations[item.orderItemId] || []}
            isHighlighted={highlightedItemId === item.orderItemId}
            onApplySuggestion={(batch) => handleApplySuggestion(item, batch)}
            onUpdateQuantity={(batchId, newQty, maxOnHand) =>
              updateAllocationQuantity(
                item.orderItemId,
                batchId,
                newQty,
                maxOnHand,
                item.requestedQuantity
              )
            }
            onRemoveAllocation={(batchId) => removeAllocation(item.orderItemId, batchId)}
            onAddManualBatch={(batch) => handleManualBatchSelect(item, batch)}
            onOpenScanModal={(medId) => {
              setScannerTargetMedicineId(medId);
              setIsScannerModalOpen(true);
            }}
          />
        ))}
      </div>

      {/* Batch Scanner & Deduction Modal */}
      <OrderBatchScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => {
          setIsScannerModalOpen(false);
          setScannerTargetMedicineId(null);
        }}
        orderNumber={suggestions.orderNumber}
        items={suggestions.items}
        allocations={allocations}
        initialMedicineId={scannerTargetMedicineId}
        onDeductBatch={(orderItemId, batch, qty, captureMethod, payload) => {
          addAllocation(orderItemId, batch, qty, captureMethod, payload);
        }}
      />

      {/* Order Rejection Modal */}
      <OrderRejectModal
        isOpen={isRejectModalOpen}
        orderNumber={suggestions.orderNumber}
        isSubmitting={isRejecting}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={(reason) => {
          rejectOrder(reason);
          setIsRejectModalOpen(false);
        }}
      />
    </div>
  );
}
