'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, X, AlertCircle, RefreshCw, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (payload: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

export function CameraScannerModal({
  isOpen,
  onClose,
  onDetected,
}: CameraScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [detectedSuccess, setDetectedSuccess] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStoppingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }
    } catch {
      // Ignore scanner stop errors
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  const handleScanSuccess = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(100);
        } catch {
          // Ignore vibration error
        }
      }
      setDetectedSuccess(cleanCode);
      void stopScanner();

      setTimeout(() => {
        onDetected(cleanCode);
        onClose();
      }, 500);
    },
    [onDetected, onClose, stopScanner]
  );

  // Initialize live camera scanning
  useEffect(() => {
    if (!isOpen) {
      void stopScanner();
      return;
    }

    if (activeTab !== 'camera') {
      void stopScanner();
      return;
    }

    let isCancelled = false;

    async function initCameraScanner() {
      setCameraError(null);

      // Check if browser has mediaDevices support
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera video is restricted by your browser in this context (browsers require HTTPS or localhost). Use "Snap Photo" or upload an image below to scan directly!'
        );
        return;
      }

      try {
        await stopScanner();
        if (isCancelled) return;

        const scannerId = 'kd-barcode-scanner';
        const scannerElement = document.getElementById(scannerId);
        if (!scannerElement) return;

        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(minDimension * 0.85),
                height: Math.floor(minDimension * 0.55),
              };
            },
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            if (!isCancelled) {
              handleScanSuccess(decodedText);
            }
          },
          () => {
            // Frame failed to decode barcode — normal while aiming
          }
        );
      } catch (err: unknown) {
        if (isCancelled) return;
        const error = err as Error;
        const msg = error.message || '';

        if (error.name === 'NotAllowedError' || msg.includes('Permission')) {
          setCameraError('Camera permission was denied. Please allow camera permissions in browser settings.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found on this device. Use photo upload or manual entry instead.');
        } else {
          setCameraError(
            'Unable to start live camera video (often blocked by mobile browsers over insecure HTTP). You can snap a photo with your camera directly using the button below!'
          );
        }
      }
    }

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      void initCameraScanner();
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      void stopScanner();
    };
  }, [isOpen, activeTab, retryKey, handleScanSuccess, stopScanner]);

  if (!isOpen) return null;

  // Process photo capture or image upload
  const handleFileScan = async (file: File) => {
    setIsProcessingFile(true);
    setCameraError(null);
    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('kd-barcode-scanner-file-helper', {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
      }

      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        handleScanSuccess(decodedText);
      } else {
        setCameraError('No barcode or DataMatrix recognized in this image. Please ensure the code is clear and well-lit.');
      }
    } catch {
      setCameraError('No barcode or DataMatrix recognized in this photo. Please retake closer and in focus, or enter code below.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileScan(file);
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
      {/* Hidden file scanner container helper */}
      <div id="kd-barcode-scanner-file-helper" className="hidden" aria-hidden="true" />

      {/* Hidden native camera capture input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Scan Barcode / QR / GS1
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Align barcode, EAN, or DataMatrix within the camera viewfinder
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
            <Upload className="w-4 h-4" /> Snap Photo / Upload
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
                <div className="w-full p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col gap-3 text-amber-800 text-xs mb-4">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{cameraError}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" /> Snap Photo with Camera
                    </button>
                    <button
                      type="button"
                      onClick={handleRetryCamera}
                      className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Live Stream
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Viewfinder element for html5-qrcode */}
              <div className="relative w-full aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
                <div id="kd-barcode-scanner" className="w-full h-full" />
              </div>

              {/* Quick snap fallback button under camera */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> Or take photo directly with mobile camera
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Mobile Camera Snap */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 transition-colors text-center group cursor-pointer"
                >
                  <Camera className="w-8 h-8 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-indigo-900">Snap Photo with Camera</span>
                  <span className="text-[10px] text-indigo-600 mt-1">Native device camera app</span>
                </button>

                {/* Option 2: Upload File / Gallery */}
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-center cursor-pointer group">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-700">Choose from Gallery / Files</span>
                  <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </label>
              </div>

              {isProcessingFile && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs flex items-center justify-center gap-2 font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  Analyzing image for barcode / DataMatrix...
                </div>
              )}

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
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
          <span>Supported: GS1 DataMatrix, EAN-13, Code 128, QR, UPC</span>
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
