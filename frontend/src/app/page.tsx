'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/Button';
import { useAuth } from '../providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black">
          KD
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Kandarp Drugs</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Wholesale Pharmacy Inventory & Order Management System
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/login" className="w-full">
            <Button variant="primary" className="w-full">
              Sign In
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full">
            <Button variant="secondary" className="w-full">
              Admin
            </Button>
          </Link>
          <Link href="/catalog" className="w-full">
            <Button variant="outline" className="w-full">
              Retailer
            </Button>
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400">
          KD-IOMS v1.0.0 • Foundation Phase 0 Initialized
        </div>
      </div>
    </div>
  );
}
