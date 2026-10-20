'use client';

import React from 'react';
import { BottomNav } from '@/components/layout/BottomNav';

const deliveryNavItems = [
  { label: 'Dispatch Pool', href: '/delivery/pool' },
  { label: 'My Deliveries', href: '/delivery/orders' },
  { label: 'Place Order', href: '/delivery/orders/new' },
];

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 sm:pb-0">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-900 text-sm tracking-wide">Kandarp Drugs</span>
          <span className="ml-2 text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
            Delivery Partner
          </span>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>
      <BottomNav items={deliveryNavItems} />
    </div>
  );
}
