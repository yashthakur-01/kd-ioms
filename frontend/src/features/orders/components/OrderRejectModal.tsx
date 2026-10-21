'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

export interface OrderRejectModalProps {
  isOpen: boolean;
  orderNumber: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const REJECTION_PRESETS = [
  'Stock damaged or expired on shelf',
  'Customer requested order cancellation',
  'Unfulfillable inventory shortage',
  'Batch price quote discrepancy',
];

export function OrderRejectModal({
  isOpen,
  orderNumber,
  isSubmitting = false,
  onClose,
  onConfirm,
}: OrderRejectModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetClick = (preset: string) => {
    setReason(preset);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError('Rejection reason must be at least 5 characters');
      return;
    }
    if (trimmed.length > 300) {
      setError('Rejection reason cannot exceed 300 characters');
      return;
    }
    setError(null);
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Reject Order {orderNumber}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                This will cancel the order and release any inventory holds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Quick Preset Reason
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REJECTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left ${
                    reason === preset
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="rejection-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason Details (Required)
              </label>
              <span className={`text-[11px] ${reason.length > 300 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                {reason.length}/300
              </span>
            </div>
            <textarea
              id="rejection-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="State clear reasons why this order cannot be fulfilled..."
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-black !text-black placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all"
            />
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 5}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Rejection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
