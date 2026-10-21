'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

export default function DeliveryChangePasswordPage() {
  const router = useRouter();

  return (
    <div className="max-w-xl mx-auto py-4 sm:py-8">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/delivery/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Deliveries
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Update Account Password
              </h1>
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                Delivery
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Set a strong, new password to keep your delivery partner account secure.
            </p>
          </div>
        </div>

        {/* Change Password Form */}
        <ChangePasswordForm
          onSuccess={() => router.push('/delivery/orders')}
          cancelHref="/delivery/orders"
        />
      </div>
    </div>
  );
}
