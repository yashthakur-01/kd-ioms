'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, X, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (payload: string) => void;
}

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect: (source: ImageBitmapSource | HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorInstance;
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onDetected,
}: CameraScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [detectedSuccess, setDetectedSuccess] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleScanSuccess = useCallback(
    (code: string) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(100);
        } catch {
          // Ignore vibration error
        }
      }
      setDetectedSuccess(code);
      stopCamera();
      setTimeout(() => {
        onDetected(code);
        onClose();
      }, 500);
    },
    [onDetected, onClose, stopCamera]
  );

  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      if (!isOpen || activeTab !== 'camera') {
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
                    handleScanSuccess(barcodes[0].rawValue);
                  }
                } catch {
                  // Ignore detection frame errors
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
          setCameraError('No camera found on this device. Use file upload instead.');
        } else {
          setCameraError(`Unable to access camera: ${error.message || 'Unknown error'}`);
        }
      }
    }

    void initCamera();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen, activeTab, retryKey, handleScanSuccess, stopCamera]);

  if (!isOpen) return null;

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
            handleScanSuccess(barcodes[0].rawValue);
          } else {
            setCameraError('No barcode recognized in the image. You can enter or paste the payload below.');
          }
        })
        .catch(() => {
          setCameraError('Could not process image file.');
        });
    } else {
      setCameraError('Barcode scanning from file is not supported in this browser. Enter the barcode below.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScanSuccess(manualCode.trim());
    }
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setRetryKey((k) => k + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Scan Barcode / QR / GS1
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Align barcode or DataMatrix within the camera viewfinder
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'camera'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" /> Live Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" /> Photo Upload / Fallback
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {detectedSuccess && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Barcode Detected!</p>
                <p className="text-xs font-mono text-emerald-700 mt-0.5 truncate">{detectedSuccess}</p>
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="flex flex-col items-center">
              {cameraError ? (
                <div className="w-full p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 text-xs mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{cameraError}</p>
                    <button
                      type="button"
                      onClick={handleRetryCamera}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Viewfinder Target Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-40 border-2 border-indigo-400 rounded-lg relative shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-600 font-medium">
                    Click to upload packaging image or take photo
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {cameraError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Direct Paste / Manual Code Fallback */}
              <form onSubmit={handleManualSubmit} className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or Paste / Enter Barcode Payload
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 01089012345678901727083110A23910"
                    style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                    className="flex-1 px-3 py-2 text-xs bg-white text-black !text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Use
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Supported: GS1 DataMatrix, EAN-13, Code 128, QR</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
