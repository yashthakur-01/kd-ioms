'use client';

import { useEffect, useRef } from 'react';

export interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxIntervalMs?: number;
}

/**
 * Custom hook to capture rapid keystrokes from USB / Bluetooth hardware barcode scanners.
 * Hardware scanners emulate a high-speed keyboard followed by an Enter key.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 8,
  maxIntervalMs = 50,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore modifier keys like Shift, Ctrl, Alt
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // If too much time has passed between keys, it's human typing — reset buffer
      if (elapsed > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        if (scanned.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScan(scanned);
        }
        bufferRef.current = '';
        return;
      }

      // Collect single character keys
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Auto-clear buffer after delay if scanner stops without Enter
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, maxIntervalMs * 3);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, onScan, minLength, maxIntervalMs]);
}
