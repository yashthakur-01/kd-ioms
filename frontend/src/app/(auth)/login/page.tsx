'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useLogin } from '@/features/auth/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/lib/api/api-error';

interface DemoCredentialsCardProps {
  onFillCredentials: (username: string, password: string) => void;
}

function DemoCredentialsCard({ onFillCredentials }: DemoCredentialsCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Fallback
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handleFillAndCopy = async (username: string, password: string, roleKey: string) => {
    onFillCredentials(username, password);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${username} / ${password}`);
      }
    } catch {
      // Fallback
    }
    setCopiedKey(`fill-${roleKey}`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  return (
    <div className="mt-6 pt-5 border-t border-slate-100">
      <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center justify-between">
        <span>Demo Credentials</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
          One-Click Fill
        </span>
      </div>

      <div className="space-y-3">
        {/* Admin Demo Account */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>Admin Account</span>
            </div>
            <button
              type="button"
              onClick={() => handleFillAndCopy('admin', 'Admin@KD2026!', 'ADMIN')}
              aria-label="Copy and fill admin credentials"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
            >
              {copiedKey === 'fill-ADMIN' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>Copied & Filled</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Auto-Fill & Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded px-2 py-1 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans">User:</span>
                <span className="font-semibold text-slate-800">admin</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('admin', 'admin-user')}
                aria-label="Copy admin username"
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                {copiedKey === 'admin-user' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded px-2 py-1 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans">Pass:</span>
                <span className="font-semibold text-slate-800">Admin@KD2026!</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('Admin@KD2026!', 'admin-pass')}
                aria-label="Copy admin password"
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                {copiedKey === 'admin-pass' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Retailer Demo Account */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Retailer (Apollo Pharmacy)</span>
            </div>
            <button
              type="button"
              onClick={() => handleFillAndCopy('apollo_pharmacy', 'Retailer@KD2026!', 'RETAILER')}
              aria-label="Copy and fill retailer credentials"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
            >
              {copiedKey === 'fill-RETAILER' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>Copied & Filled</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Auto-Fill & Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded px-2 py-1 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans">User:</span>
                <span className="font-semibold text-slate-800">apollo_pharmacy</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('apollo_pharmacy', 'ret-user')}
                aria-label="Copy retailer username"
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                {copiedKey === 'ret-user' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded px-2 py-1 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans">Pass:</span>
                <span className="font-semibold text-slate-800">Retailer@KD2026!</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('Retailer@KD2026!', 'ret-pass')}
                aria-label="Copy retailer password"
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                {copiedKey === 'ret-pass' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl');
  const { user, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; requestId?: string } | null>(null);

  const loginMutation = useLogin();

  // If already authenticated, redirect directly into the designated portal
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'ADMIN') {
        router.replace('/dashboard');
      } else if (user.role === 'RETAILER') {
        router.replace('/catalog');
      } else if (user.role === 'DELIVERY') {
        router.replace('/delivery/orders');
      }
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    try {
      const data = await loginMutation.mutateAsync({ username, password });

      if (data.user.mustChangePassword) {
        router.push('/change-password');
        return;
      }

      // Check for safe relative callback URL
      const isSafeCallback = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//');

      switch (data.user.role) {
        case 'ADMIN': {
          router.push('/dashboard');
          break;
        }
        case 'RETAILER': {
          if (
            isSafeCallback &&
            (callbackUrl.startsWith('/catalog') ||
              callbackUrl.startsWith('/cart') ||
              callbackUrl.startsWith('/orders') ||
              callbackUrl.startsWith('/profile'))
          ) {
            router.push(callbackUrl);
          } else {
            router.push('/catalog');
          }
          break;
        }
        case 'DELIVERY': {
          if (
            isSafeCallback &&
            (callbackUrl.startsWith('/delivery') ||
              callbackUrl.startsWith('/pool') ||
              callbackUrl.startsWith('/orders'))
          ) {
            router.push(callbackUrl);
          } else {
            router.push('/delivery/orders');
          }
          break;
        }
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
          placeholder="Enter username"
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

      {/* Demo Credentials Card */}
      <DemoCredentialsCard
        onFillCredentials={(u, p) => {
          setUsername(u);
          setPassword(p);
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      {/* Back button to Home */}
      <div className="w-full max-w-md mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1 px-2 rounded-lg hover:bg-slate-200/60 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      <Suspense fallback={<div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 h-80 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
