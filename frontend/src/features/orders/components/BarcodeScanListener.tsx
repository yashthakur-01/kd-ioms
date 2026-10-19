'use client';

import React from 'react';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { Scan } from 'lucide-react';

export interface BarcodeScanListenerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
}

export function BarcodeScanListener({ onScan, enabled = true }: BarcodeScanListenerProps) {
  useBarcodeScanner({
    onScan,
    enabled,
    minLength: 4,
    maxIntervalMs: 50,
  });

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <Scan className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      <span>Hardware Gun Ready</span>
    </div>
  );
}
