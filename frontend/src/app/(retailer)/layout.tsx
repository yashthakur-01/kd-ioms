'use client';

import React from 'react';
import { BottomNav } from '@/components/layout/BottomNav';

const retailerNavItems = [
  { label: 'Catalog', href: '/catalog' },
  { label: 'Cart', href: '/cart' },
  { label: 'Orders', href: '/orders' },
  { label: 'Profile', href: '/profile' },
];

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 sm:pb-0">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-900 text-sm tracking-wide">Kandarp Drugs</span>
          <span className="ml-2 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
            Retailer Portal
          </span>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>
      <BottomNav items={retailerNavItems} />
    </div>
  );
}
