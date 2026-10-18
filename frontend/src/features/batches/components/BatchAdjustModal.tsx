'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adjustBatchFormSchema, type AdjustBatchFormData } from '../schema';
import { useAdjustBatch } from '../hooks';
import type { BatchRecord } from '../types';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export interface BatchAdjustModalProps {
  batch: BatchRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BatchAdjustModal({
  batch,
  isOpen,
  onClose,
  onSuccess,
}: BatchAdjustModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const adjustMutation = useAdjustBatch();

  const isExpired = batch ? batch.daysLeft < 0 : false;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AdjustBatchFormData>({
    resolver: zodResolver(adjustBatchFormSchema),
    defaultValues: {
      type: 'DAMAGE',
      quantity: 1,
      reason: '',
    },
  });

  const selectedType = watch('type');

  const onSubmit = async (data: AdjustBatchFormData) => {
    if (!batch) return;
    setErrorMessage(null);

    try {
      await adjustMutation.mutateAsync({
        batchId: batch.batchId,
        payload: {
          type: data.type,
          quantity: data.quantity,
          reason: data.reason.trim(),
        },
      });

      reset();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to adjust stock');
    }
  };

  if (!batch) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        setErrorMessage(null);
        onClose();
      }}
      title={`Adjust Stock — ${batch.batchNumber}`}
      description={`${batch.medicineName} (${batch.medicineCompany})`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Current Stock Snapshot */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500">Current Balance:</span>
            <p className="text-sm font-bold text-slate-900">{batch.quantityOnHand} units</p>
          </div>
          <div>
            <span className="text-slate-500">Expiry Date:</span>
            <p className="text-sm font-semibold text-slate-900">
              {batch.expiryDate} {isExpired ? '(Expired)' : `(${batch.daysLeft}d left)`}
            </p>
          </div>
        </div>

        {/* Adjustment Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Adjustment Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('type')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="DAMAGE">DAMAGE (Stock Damaged / Broken)</option>
            <option value="CORRECTION">CORRECTION (Audit Count Correction)</option>
            <option value="EXPIRY_WRITEOFF" disabled={!isExpired}>
              EXPIRY_WRITEOFF (Expired Stock Disposal){!isExpired ? ' — Disabled (Not Expired)' : ''}
            </option>
          </select>
          {!isExpired && selectedType === 'EXPIRY_WRITEOFF' && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Expiry write-off is prohibited on unexpired batches.
            </p>
          )}
          {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type.message}</p>}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {selectedType === 'DAMAGE' || selectedType === 'EXPIRY_WRITEOFF'
              ? 'Units to Deduct / Write Off'
              : 'Signed Adjustment (+ for extra found, - for deficit)'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register('quantity', { valueAsNumber: true })}
            placeholder="e.g. 5"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          {errors.quantity && (
            <p className="text-xs text-red-600 mt-1">{errors.quantity.message}</p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mandatory Reason (5–300 chars) <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            {...register('reason')}
            placeholder="Explain why this stock adjustment is being performed..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason.message}</p>}
        </div>

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adjustMutation.isPending || (!isExpired && selectedType === 'EXPIRY_WRITEOFF')}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            {adjustMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Applying...
              </>
            ) : (
              'Apply Adjustment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
