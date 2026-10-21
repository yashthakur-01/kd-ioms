'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();

  const handleSuccess = () => {
    switch (user?.role) {
      case 'ADMIN':
        router.push('/dashboard');
        break;
      case 'RETAILER':
        router.push('/catalog');
        break;
      case 'DELIVERY':
        router.push('/delivery/orders');
        break;
      default:
        router.push('/login');
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
            {user?.mustChangePassword
              ? 'Please set a new secure password to activate your account.'
              : 'Set a new password to keep your account secure.'}
          </p>
        </div>

        <ChangePasswordForm
          onSuccess={handleSuccess}
          isMandatoryChange={user?.mustChangePassword}
        />
      </div>
    </div>
  );
}
