'use client';

import React, { Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Suspense fallback={<aside className="w-64 bg-slate-900 min-h-screen border-r border-slate-800 shrink-0" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">{children}</main>
    </div>
  );
}
