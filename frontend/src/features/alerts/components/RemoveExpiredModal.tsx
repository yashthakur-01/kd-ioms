'use client';

import React, { useState } from 'react';
import type { ExpiredStockItem } from '../types';
import { useRemoveExpiredBatchMutation } from '../hooks';
import { Spinner } from '../../../components/ui/Spinner';

interface RemoveExpiredModalProps {
  batch: ExpiredStockItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RemoveExpiredModal({ batch, isOpen, onClose }: RemoveExpiredModalProps) {
  const [reason, setReason] = useState('');
  const removeMutation = useRemoveExpiredBatchMutation();

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await removeMutation.mutateAsync({
        batchId: batch.batchId,
        reason: reason.trim() || undefined,
      });
      setReason('');
      onClose();
    } catch (err) {
      console.error('Failed to remove expired batch:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="p-6 bg-rose-50/70 border-b border-rose-100 flex items-start gap-3">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Remove Expired Stock</h3>
            <p className="text-xs text-slate-600 mt-0.5">Physical write-off and inventory removal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Medicine:</span>
              <span className="font-semibold text-slate-800">{batch.medicineName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Batch Number:</span>
              <span className="font-mono font-medium text-slate-800">{batch.batchNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expiry Date:</span>
              <span className="text-rose-600 font-semibold">{batch.expiryDate} ({batch.daysExpired}d ago)</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
              <span className="text-slate-700">Stock Written Off:</span>
              <span className="text-rose-700">{batch.quantityOnHand} units</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disposal Reason <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Incinerated in bio-waste or returned to manufacturer"
              className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none"
            />
            <div className="text-[10px] text-slate-400 text-right mt-0.5">{reason.length}/300</div>
          </div>

          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-[11px] leading-relaxed border border-amber-200 flex items-start gap-2">
            <span className="font-bold">⚠️ Warning:</span>
            <span>
              This will record an immutable <code>EXPIRY_WRITEOFF</code> entry in the audit ledger and reduce batch balance to zero.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={removeMutation.isPending}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={removeMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {removeMutation.isPending ? <Spinner size="sm" /> : null}
              Confirm Physical Removal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
