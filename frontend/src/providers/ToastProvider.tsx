'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  requestId?: string;
  durationMs?: number;
}

export interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  showError: (message: string, requestId?: string) => void;
  showSuccess: (message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, requestId, durationMs = 5000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, requestId, durationMs };

      setToasts((prev) => [...prev, newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  const showError = useCallback(
    (message: string, requestId?: string) => {
      showToast({ type: 'error', message, requestId });
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast({ type: 'success', message });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, addToast: showToast, showError, showSuccess, dismissToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg shadow-lg border p-4 text-sm transition-all duration-300 transform translate-y-0 ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {toast.title && <div className="font-semibold text-xs uppercase mb-1">{toast.title}</div>}
                <div className="font-medium">{toast.message}</div>
                {toast.requestId && (
                  <div className="mt-1 text-xs opacity-75 font-mono select-all">
                    Ref: {toast.requestId}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity p-1 text-lg leading-none"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
