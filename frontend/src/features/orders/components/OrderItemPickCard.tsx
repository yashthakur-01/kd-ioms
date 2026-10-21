'use client';

import React, { useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, Clock, Package } from 'lucide-react';
import { FefoSuggestionChips } from './FefoSuggestionChips';
import { BatchAllocationRow } from './BatchAllocationRow';
import type { ItemPickSuggestion, BatchPickSuggestion } from '../../../lib/api/orders.api';
import type { PickedAllocation } from '../hooks/useOrderPicking';

export interface OrderItemPickCardProps {
  item: ItemPickSuggestion;
  allocations: PickedAllocation[];
  isHighlighted?: boolean;
  onApplySuggestion: (batch: BatchPickSuggestion) => void;
  onUpdateQuantity: (batchId: number, newQty: number, maxOnHand: number) => void;
  onRemoveAllocation: (batchId: number) => void;
  onAddManualBatch: (batch: BatchPickSuggestion) => void;
  onOpenScanModal: (medicineId: number) => void;
}

export function OrderItemPickCard({
  item,
  allocations,
  isHighlighted = false,
  onApplySuggestion,
  onUpdateQuantity,
  onRemoveAllocation,
  onAddManualBatch,
  onOpenScanModal,
}: OrderItemPickCardProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  const totalPicked = allocations.reduce((sum, a) => sum + a.quantity, 0);
  const remainingShortfall = Math.max(0, item.requestedQuantity - totalPicked);
  const allocatedBatchIds = allocations.map((a) => a.batchId);

  // Batches available for manual selection (not yet allocated)
  const availableBatches = item.batches.filter(
    (b) => !allocatedBatchIds.includes(b.batchId) && b.quantityOnHand > 0
  );

  const getStatusBadge = () => {
    if (totalPicked === item.requestedQuantity) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          FULL ({totalPicked}/{item.requestedQuantity})
        </span>
      );
    }
    if (totalPicked > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" />
          PARTIAL ({totalPicked}/{item.requestedQuantity})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        <Package className="w-3.5 h-3.5" />
        NONE (0/{item.requestedQuantity})
      </span>
    );
  };

  const handleSelectBatch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const batchId = Number(val);
    const found = item.batches.find((b) => b.batchId === batchId);
    if (found) {
      onAddManualBatch(found);
    }
    setSelectedBatchId('');
  };

  return (
    <div
      data-testid={`pick-card-${item.orderItemId}`}
      className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${
        isHighlighted
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-emerald-500/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {item.medicineName}
            </h3>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{item.company}</span>
            {' • '}
            <span>Pack: {item.packSize}</span>
            {' • '}
            <span>Quoted: ₹{item.quotedPriceInclGst} (incl. GST)</span>
          </p>
        </div>

        {/* Scan & Action buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => onOpenScanModal(item.medicineId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Pack</span>
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 space-y-4">
        {/* FEFO suggestions */}
        <FefoSuggestionChips
          batches={item.batches}
          allocatedBatchIds={allocatedBatchIds}
          requestedQuantity={item.requestedQuantity}
          onApplySuggestion={onApplySuggestion}
        />

        {/* Allocations list */}
        {allocations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Picked Batches ({allocations.length}):</span>
              <span>
                Total Picked: <strong className="text-slate-900 dark:text-white font-mono">{totalPicked}</strong> / {item.requestedQuantity}
              </span>
            </div>

            <div className="space-y-2">
              {allocations.map((alloc) => (
                <BatchAllocationRow
                  key={alloc.batchId}
                  allocation={alloc}
                  maxOnHand={alloc.maxOnHand}
                  remainingShortfall={remainingShortfall}
                  onUpdateQuantity={(newQty) =>
                    onUpdateQuantity(alloc.batchId, newQty, alloc.maxOnHand)
                  }
                  onRemove={() => onRemoveAllocation(alloc.batchId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Manual batch selection if shortfall > 0 and other batches available */}
        {remainingShortfall > 0 && availableBatches.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Choose alternative batch:</span>
            <select
              value={selectedBatchId}
              onChange={handleSelectBatch}
              aria-label={`Choose alternative batch for ${item.medicineName}`}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-black !text-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Select Active Batch --</option>
              {availableBatches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchNumber} (Exp: {b.expiryDate}, Stock: {b.quantityOnHand}, ₹{b.priceInclGst})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Shortfall warning callout */}
        {remainingShortfall > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Shortfall Notice: </span>
              {remainingShortfall} unit{remainingShortfall > 1 ? 's' : ''} unpicked. Under wholesale rules, unallocated quantity is permanently dropped without backorders.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
