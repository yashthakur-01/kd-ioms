'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
  shopName?: string;
}

const PRESET_CHIPS = [
  'Invalid Drug License format',
  'GSTIN and shop name mismatch',
  'Incomplete address details',
  'License expired or suspended',
];

export function RejectionModal(props: RejectionModalProps) {
  if (!props.isOpen) return null;
  return <RejectionModalContent {...props} />;
}

function RejectionModalContent({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  shopName,
}: RejectionModalProps) {
  const [reason, setReason] = useState('');

  const handleChipClick = (preset: string) => {
    setReason((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.includes(preset)) return prev;
      return `${trimmed}. ${preset}`;
    });
  };

  const trimmedReason = reason.trim();
  const charCount = reason.length;
  const isValidLength = trimmedReason.length >= 5 && trimmedReason.length <= 300;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidLength && !isLoading) {
      onConfirm(trimmedReason);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Retailer Application"
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSubmit}
            disabled={!isValidLength || isLoading}
            isLoading={isLoading}
          >
            Confirm Rejection
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 mb-2">
            Please provide a specific reason (5–300 characters) explaining why this application was
            rejected{shopName ? ` for ${shopName}` : ''}. The retailer will see these exact remarks
            and can resubmit.
          </p>

          {/* Quick-select preset chips */}
          <div className="mb-3">
            <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Quick-Select Compliance Reasons:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CHIPS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleChipClick(preset)}
                  className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 transition-colors cursor-pointer select-none"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-1">
            <label
              htmlFor="rejection-reason"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Rejection Remarks <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="rejection-reason"
              rows={4}
              maxLength={300}
              placeholder="Explain the specific discrepancy or missing documentation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-500 transition-colors"
            />
            <div className="flex justify-between items-center text-xs">
              <span className={trimmedReason.length > 0 && trimmedReason.length < 5 ? 'text-rose-600 font-medium' : 'text-slate-400'}>
                {trimmedReason.length < 5 ? 'Minimum 5 characters required' : 'Clear & actionable feedback'}
              </span>
              <span className={`font-mono ${charCount > 300 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                {charCount} / 300
              </span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
