'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useLogin } from '@/features/auth/hooks';
import { ApiError } from '@/lib/api/api-error';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; requestId?: string } | null>(null);

  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    try {
      const data = await loginMutation.mutateAsync({ username, password });

      if (data.user.mustChangePassword) {
        router.push('/change-password');
        return;
      }

      switch (data.user.role) {
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
          message: 'An unexpected error occurred while signing in. Please try again.',
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl mb-3 font-bold text-xl">
            KD
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kandarp Drugs</h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            Inventory & Order Management System
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
            id="login-username"
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin or store_user"
            autoComplete="username"
          />

          <Input
            id="login-password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={loginMutation.isPending}
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
