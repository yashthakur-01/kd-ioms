'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Check, X, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useChangePassword } from '@/features/auth/hooks';
import { ApiError } from '@/lib/api/api-error';

export interface ChangePasswordFormProps {
  onSuccess?: () => void;
  cancelHref?: string;
  isMandatoryChange?: boolean;
}

export function ChangePasswordForm({
  onSuccess,
  cancelHref,
  isMandatoryChange = false,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ message: string; requestId?: string } | null>(null);

  const changePasswordMutation = useChangePassword();

  // Password rules validation for visual checklist
  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const differsFromCurrent =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasLetter &&
    hasDigit &&
    passwordsMatch &&
    differsFromCurrent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    if (!isFormValid) {
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorDetails({
          message: err.message,
          requestId: err.requestId,
        });
      } else {
        setErrorDetails({
          message: 'Failed to update password. Please verify current credentials.',
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="change-password-form">
      {errorDetails && (
        <ErrorBanner
          message={errorDetails.message}
          requestId={errorDetails.requestId}
        />
      )}

      {/* Current Password Field */}
      <div>
        <label
          htmlFor="current-password"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
        >
          {isMandatoryChange ? 'Current Password (Temporary)' : 'Current Password'}
        </label>
        <div className="relative">
          <input
            id="current-password"
            type={showCurrent ? 'text' : 'password'}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white text-black !text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            tabIndex={-1}
            aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New Password Field */}
      <div>
        <label
          htmlFor="new-password"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
        >
          New Password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showNew ? 'text' : 'password'}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 10 characters with letter & number"
            autoComplete="new-password"
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white text-black !text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            tabIndex={-1}
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password Field */}
      <div>
        <label
          htmlFor="confirm-password"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white text-black !text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Password complexity checklist */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          Password Requirements:
        </p>
        <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
          {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 text-center leading-none">○</span>}
          <span>At least 10 characters long</span>
        </div>
        <div className={`flex items-center gap-2 ${hasLetter ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
          {hasLetter ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 text-center leading-none">○</span>}
          <span>Contains at least one letter</span>
        </div>
        <div className={`flex items-center gap-2 ${hasDigit ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
          {hasDigit ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 text-center leading-none">○</span>}
          <span>Contains at least one number</span>
        </div>
        <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
          {passwordsMatch ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 text-center leading-none">○</span>}
          <span>Passwords match</span>
        </div>
        <div className={`flex items-center gap-2 ${differsFromCurrent ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
          {differsFromCurrent ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 text-center leading-none">○</span>}
          <span>Different from current password</span>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        {cancelHref && (
          <Link
            href={cancelHref}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </Link>
        )}

        <Button
          type="submit"
          variant="primary"
          className="flex-1 py-2.5 text-xs font-bold"
          disabled={!isFormValid || changePasswordMutation.isPending}
          isLoading={changePasswordMutation.isPending}
        >
          <KeyRound className="w-4 h-4 mr-1.5" />
          Update Password
        </Button>
      </div>
    </form>
  );
}
