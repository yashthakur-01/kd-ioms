'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useChangePassword } from '@/features/auth/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/lib/api/api-error';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; requestId?: string } | null>(null);

  const changePasswordMutation = useChangePassword();

  // Password rules validation for visual checklist
  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const differsFromCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;

  const isFormValid = hasMinLength && hasLetter && hasDigit && passwordsMatch && differsFromCurrent;

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

      // Redirect into role portal after successful password change
      switch (user?.role) {
        case 'ADMIN':
          router.push('/dashboard');
          break;
        case 'RETAILER':
          router.push('/catalog');
          break;
        case 'DELIVERY':
          router.push('/pool');
          break;
        default:
          router.push('/login');
      }
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 text-amber-800 rounded-xl mb-3 font-bold text-xl">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Change Password</h2>
          <p className="text-xs text-slate-500 mt-1">
            Please set a new secure password to activate your account.
          </p>
        </div>

        {errorDetails && (
          <ErrorBanner
            className="mb-5"
            message={errorDetails.message}
            requestId={errorDetails.requestId}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="current-password"
            label="Current Password (Temporary)"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <Input
            id="new-password"
            label="New Password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 10 characters"
            autoComplete="new-password"
          />

          <Input
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />

          {/* Password complexity checklist */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700 mb-1">Password Requirements:</p>
            <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span>{hasMinLength ? '✓' : '○'}</span>
              <span>At least 10 characters long</span>
            </div>
            <div className={`flex items-center gap-2 ${hasLetter ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span>{hasLetter ? '✓' : '○'}</span>
              <span>Contains at least one letter</span>
            </div>
            <div className={`flex items-center gap-2 ${hasDigit ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span>{hasDigit ? '✓' : '○'}</span>
              <span>Contains at least one number</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span>{passwordsMatch ? '✓' : '○'}</span>
              <span>Passwords match</span>
            </div>
            <div className={`flex items-center gap-2 ${differsFromCurrent ? 'text-emerald-700' : 'text-slate-500'}`}>
              <span>{differsFromCurrent ? '✓' : '○'}</span>
              <span>Different from current temporary password</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={!isFormValid || changePasswordMutation.isPending}
            isLoading={changePasswordMutation.isPending}
          >
            Update Password & Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
