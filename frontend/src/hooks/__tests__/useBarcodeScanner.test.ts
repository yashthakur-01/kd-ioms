import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeScanner } from '../useBarcodeScanner.js';

describe('useBarcodeScanner Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers onScan when rapid keystrokes are followed by Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, minLength: 8, maxIntervalMs: 50 }));

    const barcode = '08901234567890';
    for (const char of barcode) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
      vi.advanceTimersByTime(10); // 10ms between keystrokes (scanner speed)
    }

    // Press Enter
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('08901234567890');
  });

  it('resets buffer when typing is too slow (human typing)', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, minLength: 8, maxIntervalMs: 50 }));

    // Type 4 characters rapidly
    for (const char of '1234') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
      vi.advanceTimersByTime(10);
    }

    // Wait 200ms (human pause)
    vi.advanceTimersByTime(200);

    // Type 4 characters rapidly
    for (const char of '5678') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
      vi.advanceTimersByTime(10);
    }

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    // Length of '5678' is 4 < minLength 8, so onScan is not called
    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores keystrokes when enabled is false', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, enabled: false }));

    for (const char of '08901234567890') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
      vi.advanceTimersByTime(10);
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onScan).not.toHaveBeenCalled();
  });
});
