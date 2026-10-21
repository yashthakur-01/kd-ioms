'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Scan,
  X,
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  Package,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { resolveScan, type ItemPickSuggestion, type BatchPickSuggestion } from '../../../lib/api/orders.api';
import { type PickedAllocation, playChime } from '../hooks/useOrderPicking';

export interface OrderBatchScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  items: ItemPickSuggestion[];
  allocations: Record<number, PickedAllocation[]>;
  initialMedicineId?: number | null;
  onDeductBatch: (
    orderItemId: number,
    batch: {
      batchId: number;
      batchNumber: string;
      expiryDate: string;
      quantityOnHand: number;
      priceInclGst: string;
      withinQuote?: boolean;
    },
    quantity: number,
    captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL',
    scannedPayload?: string
  ) => void;
}

interface ResolvedBatchContext {
  item: ItemPickSuggestion;
  batch: {
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    quantityOnHand: number;
    priceInclGst: string;
    withinQuote?: boolean;
    medicineName?: string;
  };
  captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL';
  payload?: string;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: new (options?: { formats: string[] }) => {
    detect: (source: ImageBitmapSource | HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
  };
}

export function OrderBatchScannerModal({
  isOpen,
  onClose,
  orderNumber,
  items,
  allocations,
  initialMedicineId,
  onDeductBatch,
}: OrderBatchScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'gun' | 'camera' | 'browse'>('gun');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Resolved batch state ready for quantity deduction
  const [resolvedContext, setResolvedContext] = useState<ResolvedBatchContext | null>(null);
  const [deductionQty, setDeductionQty] = useState<number>(1);

  // Camera state
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessInfo(null);
      setResolvedContext(null);
      setBarcodeInput('');
      // If initialMedicineId passed, switch to browse or pre-filter
      if (initialMedicineId) {
        const found = items.find((i) => i.medicineId === initialMedicineId);
        if (found) {
          const batches = found.batches || (found as any).suggestions || [];
          if (batches.length > 0) {
            // Pre-select first FEFO batch for this medicine
            selectBatchDirectly(found, batches[0], 'MANUAL');
            return;
          }
        }
      }
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    } else {
      stopCamera();
    }
  }, [isOpen, initialMedicineId, items, stopCamera]);

  // Handle batch selection directly (from browse or suggestion)
  const selectBatchDirectly = useCallback(
    (
      item: ItemPickSuggestion,
      batch: BatchPickSuggestion,
      captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL',
      payload?: string
    ) => {
      const lineAllocs = allocations[item.orderItemId] || [];
      const otherTotal = lineAllocs
        .filter((a) => a.batchId !== batch.batchId)
        .reduce((sum, a) => sum + a.quantity, 0);
      const remainingShortfall = Math.max(0, item.requestedQuantity - otherTotal);

      const existingThisBatch = lineAllocs.find((a) => a.batchId === batch.batchId);
      const currentQty = existingThisBatch?.quantity || 0;

      // Suggest remaining needed, capped at batch stock
      const initialDeduct = remainingShortfall > 0
        ? Math.min(remainingShortfall, batch.quantityOnHand)
        : currentQty > 0
        ? currentQty
        : 1;

      setResolvedContext({
        item,
        batch: {
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantityOnHand: batch.quantityOnHand,
          priceInclGst: batch.priceInclGst,
          withinQuote: batch.withinQuote,
          medicineName: item.medicineName,
        },
        captureMethod,
        payload,
      });
      setDeductionQty(Math.max(1, initialDeduct));
      setErrorMessage(null);
      setSuccessInfo(null);
      stopCamera();
    },
    [allocations, stopCamera]
  );

  // Camera initialization
  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      if (!isOpen || activeTab !== 'camera' || resolvedContext) {
        stopCamera();
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const win = window as unknown as WindowWithBarcodeDetector;
          if (win.BarcodeDetector) {
            const barcodeDetector = new win.BarcodeDetector({
              formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'data_matrix'],
            });

            scanIntervalRef.current = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState === 4) {
                try {
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                    const detected = barcodes[0].rawValue;
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate(100);
                      } catch {}
                    }
                    stopCamera();
                    handleResolveCode(detected, 'SCAN_CAMERA');
                  }
                } catch {
                  // Frame decode ignore
                }
              }
            }, 300);
          }
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const error = err as Error;
        if (error.name === 'NotAllowedError') {
          setCameraError('Camera permission was denied. Please allow camera access in browser settings.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found on this device.');
        } else {
          setCameraError(`Camera error: ${error.message || 'Unknown error'}`);
        }
      }
    }

    void initCamera();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen, activeTab, resolvedContext, stopCamera]);

  // Code resolution logic (handles barcode, GTIN, batch number)
  const handleResolveCode = async (
    code: string,
    captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL'
  ) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsResolving(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      // 1. First check if it directly matches a batch number in the current order's items
      for (const item of items) {
        const batches = item.batches || (item as any).suggestions || [];
        const localMatch = batches.find(
          (b: BatchPickSuggestion) =>
            b.batchNumber.toLowerCase().trim() === trimmed.toLowerCase()
        );
        if (localMatch) {
          selectBatchDirectly(item, localMatch, captureMethod, trimmed);
          setIsResolving(false);
          playChime('success');
          return;
        }
      }

      // 2. Call backend resolve-scan API
      const res = await resolveScan(trimmed);
      if (!res.success || !res.data?.resolved || !res.data.batch) {
        playChime('error');
        setErrorMessage(
          res.message ||
            res.data?.message ||
            `Barcode / Batch "${trimmed}" could not be matched to an active warehouse batch.`
        );
        setIsResolving(false);
        return;
      }

      const resolvedBatch = res.data.batch;

      // 3. Find corresponding item in this order
      const matchingOrderItem = items.find(
        (i) => i.medicineId === resolvedBatch.medicineId
      );

      if (!matchingOrderItem) {
        playChime('error');
        setErrorMessage(
          `Scanned medicine "${resolvedBatch.medicineName}" (Batch: ${resolvedBatch.batchNumber}) is NOT part of Order #${orderNumber}.`
        );
        setIsResolving(false);
        return;
      }

      // 4. Batch found in order item!
      const lineAllocs = allocations[matchingOrderItem.orderItemId] || [];
      const otherTotal = lineAllocs
        .filter((a) => a.batchId !== resolvedBatch.batchId)
        .reduce((sum, a) => sum + a.quantity, 0);
      const remainingShortfall = Math.max(0, matchingOrderItem.requestedQuantity - otherTotal);

      const existingThisBatch = lineAllocs.find((a) => a.batchId === resolvedBatch.batchId);
      const currentQty = existingThisBatch?.quantity || 0;

      const initialDeduct = remainingShortfall > 0
        ? Math.min(remainingShortfall, resolvedBatch.quantityOnHand)
        : currentQty > 0
        ? currentQty
        : 1;

      setResolvedContext({
        item: matchingOrderItem,
        batch: {
          batchId: resolvedBatch.batchId,
          batchNumber: resolvedBatch.batchNumber,
          expiryDate: resolvedBatch.expiryDate,
          quantityOnHand: resolvedBatch.quantityOnHand,
          priceInclGst: resolvedBatch.priceInclGst,
          withinQuote: true,
          medicineName: matchingOrderItem.medicineName,
        },
        captureMethod,
        payload: trimmed,
      });
      setDeductionQty(Math.max(1, initialDeduct));
      playChime('success');
    } catch (err: unknown) {
      playChime('error');
      const error = err as Error;
      setErrorMessage(error.message || 'Error occurred while resolving scan.');
    } finally {
      setIsResolving(false);
    }
  };

  // Submit manual barcode search
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleResolveCode(barcodeInput.trim(), 'SCAN_GUN');
    }
  };

  // Handle file photo scan
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const win = window as unknown as WindowWithBarcodeDetector;
    if (win.BarcodeDetector && 'createImageBitmap' in window) {
      createImageBitmap(file)
        .then(async (bitmap) => {
          if (!win.BarcodeDetector) return;
          const barcodeDetector = new win.BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'data_matrix'],
          });
          const barcodes = await barcodeDetector.detect(bitmap);
          if (barcodes.length > 0 && barcodes[0]?.rawValue) {
            handleResolveCode(barcodes[0].rawValue, 'SCAN_CAMERA');
          } else {
            setErrorMessage('No barcode recognized in the uploaded image. Please enter the batch number manually.');
          }
        })
        .catch(() => {
          setErrorMessage('Could not process image file.');
        });
    } else {
      setErrorMessage('Barcode image scanning is not supported by this browser. Enter the batch number manually.');
    }
  };

  // Confirm and apply deduction to batch
  const handleConfirmDeduct = () => {
    if (!resolvedContext) return;
    const { item, batch, captureMethod, payload } = resolvedContext;

    if (deductionQty <= 0) {
      setErrorMessage('Deduction quantity must be at least 1.');
      return;
    }

    if (deductionQty > batch.quantityOnHand) {
      setErrorMessage(
        `Cannot deduct ${deductionQty} units. Only ${batch.quantityOnHand} available in warehouse stock.`
      );
      return;
    }

    onDeductBatch(item.orderItemId, batch, deductionQty, captureMethod, payload);
    playChime('success');

    const totalPickedNow =
      (allocations[item.orderItemId] || [])
        .filter((a) => a.batchId !== batch.batchId)
        .reduce((sum, a) => sum + a.quantity, 0) + deductionQty;

    setSuccessInfo(
      `Successfully deducted & allocated ${deductionQty} units of Batch ${batch.batchNumber} for "${item.medicineName}" (Now ${totalPickedNow}/${item.requestedQuantity} picked).`
    );

    // Reset resolved context so user can scan next medicine/batch
    setResolvedContext(null);
    setBarcodeInput('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Scan & Deduct Batch Quantity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Order <span className="font-mono font-bold text-slate-700 dark:text-slate-300">#{orderNumber}</span> • Scan pack or choose batch to deduct stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successInfo && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successInfo}</div>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 dark:text-rose-400 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {resolvedContext ? (
            /* ==========================================
               STEP 2: BATCH RESOLVED & ENTER DEDUCTION QTY
               ========================================== */
            <div className="space-y-5 animate-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Matched Medicine
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {resolvedContext.item.medicineName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {resolvedContext.item.company} • Pack: {resolvedContext.item.packSize}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Order Needed
                    </span>
                    <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {resolvedContext.item.requestedQuantity}
                    </span>
                  </div>
                </div>

                {/* Batch Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-purple-200/80 dark:border-purple-800/40 text-xs">
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-400 block font-semibold">Batch No.</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {resolvedContext.batch.batchNumber}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-400 block font-semibold">Expiry Date</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {resolvedContext.batch.expiryDate}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-400 block font-semibold">Stock on Hand</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      {resolvedContext.batch.quantityOnHand} units
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <span className="text-[10px] text-slate-400 block font-semibold">Rate</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      ₹{resolvedContext.batch.priceInclGst}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deduction Quantity Entry Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label
                      htmlFor="deduction-qty-input"
                      className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block"
                    >
                      Quantity to Deduct & Allocate
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Enter the number of packs to deduct from this batch for the order
                    </span>
                  </div>
                  {resolvedContext.batch.quantityOnHand < deductionQty && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-md border border-rose-200">
                      Exceeds Stock!
                    </span>
                  )}
                </div>

                {/* Big Stepper & Direct Input */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeductionQty((q) => Math.max(1, q - 1))}
                    disabled={deductionQty <= 1}
                    className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg transition-colors shadow-sm"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex-1">
                    <input
                      id="deduction-qty-input"
                      type="number"
                      min={1}
                      max={resolvedContext.batch.quantityOnHand}
                      value={deductionQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setDeductionQty(val);
                        } else {
                          setDeductionQty(0);
                        }
                      }}
                      style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                      className="w-full h-12 text-center text-2xl font-black font-mono text-black !text-black bg-white rounded-xl border-2 border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDeductionQty((q) =>
                        Math.min(resolvedContext.batch.quantityOnHand, q + 1)
                      )
                    }
                    disabled={deductionQty >= resolvedContext.batch.quantityOnHand}
                    className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg transition-colors shadow-sm"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Selection Presets */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Quick Presets:</span>
                  {/* All Needed shortcut */}
                  {(() => {
                    const lineAllocs = allocations[resolvedContext.item.orderItemId] || [];
                    const otherTotal = lineAllocs
                      .filter((a) => a.batchId !== resolvedContext.batch.batchId)
                      .reduce((sum, a) => sum + a.quantity, 0);
                    const needed = Math.max(0, resolvedContext.item.requestedQuantity - otherTotal);
                    const fillQty = Math.min(needed, resolvedContext.batch.quantityOnHand);
                    if (fillQty > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => setDeductionQty(fillQty)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 border border-indigo-200 dark:border-indigo-800 transition-colors"
                        >
                          All Needed ({fillQty})
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    type="button"
                    onClick={() => setDeductionQty(1)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    1 unit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeductionQty((q) =>
                        Math.min(resolvedContext.batch.quantityOnHand, q + 5)
                      )
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeductionQty((q) =>
                        Math.min(resolvedContext.batch.quantityOnHand, q + 10)
                      )
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductionQty(resolvedContext.batch.quantityOnHand)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    Max Stock ({resolvedContext.batch.quantityOnHand})
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvedContext(null)}
                  className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Scan Different Batch
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeduct}
                  disabled={deductionQty <= 0 || deductionQty > resolvedContext.batch.quantityOnHand}
                  className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Deduct & Allocate {deductionQty} Unit(s)</span>
                </button>
              </div>
            </div>
          ) : (
            /* ==========================================
               STEP 1: SCANNER OR SELECT MEDICINE / BATCH
               ========================================== */
            <div className="space-y-5">
              {/* Mode Tabs */}
              <div className="flex border border-slate-200 dark:border-slate-800 rounded-2xl p-1 bg-slate-50 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setActiveTab('gun')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'gun'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5 text-purple-600" />
                  <span>Barcode / Gun / Manual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'camera'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Camera Scanner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'browse'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  <span>Order Items List</span>
                </button>
              </div>

              {/* TAB 1: BARCODE / SCAN GUN / TEXT */}
              {activeTab === 'gun' && (
                <div className="space-y-4">
                  <form onSubmit={handleManualSearch} className="space-y-3">
                    <label
                      htmlFor="scan-code-input"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 block"
                    >
                      Scan Barcode or Enter Batch Number / GS1:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Scan className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={barcodeInputRef}
                          id="scan-code-input"
                          type="text"
                          placeholder="Point barcode scanner gun here or type batch number..."
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                          className="w-full pl-11 pr-4 py-3 bg-white text-black !text-black rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResolving || !barcodeInput.trim()}
                        className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-600/20"
                      >
                        {isResolving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span>Find Batch</span>
                      </button>
                    </div>
                  </form>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Supported Scans:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                      <li>USB / Bluetooth physical barcode gun scan directly into this field</li>
                      <li>Standard 1D Barcode, GS1 DataMatrix 2D Code, or QR Code</li>
                      <li>Plain Batch Number (e.g. <span className="font-mono">AUG-B101</span>, <span className="font-mono">DOL-2024</span>)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: CAMERA SCANNER */}
              {activeTab === 'camera' && (
                <div className="space-y-4">
                  <div className="relative aspect-video max-h-[300px] w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Target */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-36 border-2 border-purple-400 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-purple-500 -mt-1 -ml-1 rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-purple-500 -mt-1 -mr-1 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-purple-500 -mb-1 -ml-1 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-purple-500 -mb-1 -mr-1 rounded-br" />
                        <div className="w-full h-0.5 bg-rose-500/80 animate-pulse absolute top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-950/80 p-4 flex flex-col items-center justify-center text-center text-white space-y-2">
                        <AlertCircle className="w-8 h-8 text-rose-500" />
                        <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                      </div>
                    )}
                  </div>

                  {/* Or upload barcode image file */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Or scan from photo / label file:</span>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 transition-colors shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Label Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: ORDER ITEMS LIST (QUICK SELECT) */}
              {activeTab === 'browse' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Select a medicine and batch directly from this order to deduct quantity:
                  </p>
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {items.map((item) => {
                      const lineAllocs = allocations[item.orderItemId] || [];
                      const picked = lineAllocs.reduce((sum, a) => sum + a.quantity, 0);
                      const batches = item.batches || (item as any).suggestions || [];

                      return (
                        <div
                          key={item.orderItemId}
                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {item.medicineName}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {item.company} • Pack: {item.packSize}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                picked === item.requestedQuantity
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : picked > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {picked}/{item.requestedQuantity} Picked
                            </span>
                          </div>

                          {/* Batches for this medicine */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {batches.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">No batches available</span>
                            ) : (
                              batches.map((b: BatchPickSuggestion) => (
                                <button
                                  key={b.batchId}
                                  type="button"
                                  onClick={() => selectBatchDirectly(item, b, 'MANUAL')}
                                  className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
                                >
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {b.batchNumber}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({b.quantityOnHand} stock)
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {items.length} medicine line{items.length > 1 ? 's' : ''} in Order #{orderNumber}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
