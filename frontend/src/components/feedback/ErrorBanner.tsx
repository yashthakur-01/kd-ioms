import React from 'react';

export interface ErrorBannerProps {
  message: string;
  requestId?: string;
  className?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, requestId, className = '', onRetry }: ErrorBannerProps) {
  return (
    <div className={`p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 ${className}`} role="alert">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">Action Failed</h4>
          <p className="mt-1 text-xs text-rose-700">{message}</p>
          {requestId && (
            <p className="mt-2 text-xs font-mono text-rose-600 bg-rose-100/70 inline-block px-2 py-0.5 rounded">
              Ref: {requestId}
            </p>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
