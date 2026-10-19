'use client';

import React from 'react';
import { Sparkles, Check, AlertCircle } from 'lucide-react';
import type { BatchPickSuggestion } from '../../../lib/api/orders.api';

export interface FefoSuggestionChipsProps {
  batches: BatchPickSuggestion[];
  allocatedBatchIds: number[];
  requestedQuantity: number;
  onApplySuggestion: (batch: BatchPickSuggestion) => void;
}

export function FefoSuggestionChips({
  batches,
  allocatedBatchIds,
  requestedQuantity,
  onApplySuggestion,
}: FefoSuggestionChipsProps) {
  if (!batches || batches.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic py-1">
        No active unexpired batches available for this medicine.
      </div>
    );
  }

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryStr: string) => {
    try {
      const exp = new Date(expiryStr);
      const now = new Date();
      return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Strict FEFO Suggestions (Earliest Expiry First):</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {batches.map((batch, index) => {
          const isAllocated = allocatedBatchIds.includes(batch.batchId);
          const daysLeft = getDaysUntilExpiry(batch.expiryDate);
          const isNearExpiry = daysLeft <= 90;
          const isPrimary = index === 0 && batch.suggestedQty > 0;

          return (
            <button
              key={batch.batchId}
              type="button"
              onClick={() => onApplySuggestion(batch)}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all border text-left ${
                isAllocated
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : isPrimary
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 hover:border-indigo-400 shadow-sm'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold tracking-tight">{batch.batchNumber}</span>
                  {isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold bg-indigo-600 text-white uppercase tracking-wider">
                      FEFO #1
                    </span>
                  )}
                  {isNearExpiry && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> {daysLeft}d left
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Exp: {batch.expiryDate}</span>
                  <span>•</span>
                  <span>{batch.quantityOnHand} in stock</span>
                  <span>•</span>
                  <span>₹{batch.priceInclGst}/unit</span>
                </div>
              </div>

              <div className="ml-auto pl-2 border-l border-slate-200 dark:border-slate-700 shrink-0">
                {isAllocated ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Allocated
                  </span>
                ) : (
                  <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    Pick {batch.suggestedQty > 0 ? batch.suggestedQty : Math.min(batch.quantityOnHand, requestedQuantity)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
