'use client';

import React from 'react';
import { Minus, Plus, Trash2, Scan, Camera, Keyboard } from 'lucide-react';
import type { PickedAllocation } from '../hooks/useOrderPicking';

export interface BatchAllocationRowProps {
  allocation: PickedAllocation;
  maxOnHand: number;
  remainingShortfall: number;
  onUpdateQuantity: (newQty: number) => void;
  onRemove: () => void;
}

export function BatchAllocationRow({
  allocation,
  maxOnHand,
  remainingShortfall,
  onUpdateQuantity,
  onRemove,
}: BatchAllocationRowProps) {
  const canIncrement = allocation.quantity < maxOnHand && remainingShortfall > 0;
  const canDecrement = allocation.quantity > 1;

  const getCaptureBadge = () => {
    switch (allocation.captureMethod) {
      case 'SCAN_GUN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Scan className="w-3 h-3" /> Gun
          </span>
        );
      case 'SCAN_CAMERA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Camera className="w-3 h-3" /> Camera
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Keyboard className="w-3 h-3" /> Manual
          </span>
        );
    }
  };

  const lineSubtotal = (allocation.quantity * Number(allocation.priceInclGst || 0)).toFixed(2);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
      {/* Batch info */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {allocation.batchNumber}
            </span>
            {getCaptureBadge()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Exp: <span className="font-medium text-slate-700 dark:text-slate-300">{allocation.expiryDate}</span>
            {' • '}
            Stock: <span className="font-medium text-slate-700 dark:text-slate-300">{maxOnHand}</span>
            {' • '}
            Rate: ₹{allocation.priceInclGst}/unit
          </div>
        </div>
      </div>

      {/* Stepper & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-4">
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={!canDecrement}
            onClick={() => onUpdateQuantity(allocation.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <input
            type="number"
            data-testid={`qty-display-${allocation.batchId}`}
            aria-label={`Quantity for batch ${allocation.batchNumber}`}
            min={1}
            max={Math.min(maxOnHand, remainingShortfall + allocation.quantity)}
            value={allocation.quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                onUpdateQuantity(val);
              }
            }}
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-12 text-center font-bold text-black !text-black bg-white rounded border border-slate-300 dark:border-slate-600 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

          <button
            type="button"
            aria-label="Increase quantity"
            disabled={!canIncrement}
            onClick={() => onUpdateQuantity(allocation.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subtotal */}
        <div className="text-right min-w-[70px]">
          <span className="font-bold text-slate-900 dark:text-white block font-mono">
            ₹{lineSubtotal}
          </span>
          <span className="text-[10px] text-slate-400">incl. GST</span>
        </div>

        {/* Delete */}
        <button
          type="button"
          aria-label="Remove batch allocation"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
