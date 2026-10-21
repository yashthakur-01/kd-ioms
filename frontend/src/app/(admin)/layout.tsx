'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Menu, Bell } from 'lucide-react';
import { useAlertsBadgeCount } from '@/features/alerts/hooks';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: alertCount } = useAlertsBadgeCount();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Top Navigation Header */}
      <header className="lg:hidden h-14 bg-slate-900 text-white border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              KD
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide block leading-none">KD-IOMS</span>
              <span className="text-[10px] text-emerald-400 font-medium leading-tight">Admin</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof alertCount === 'number' && alertCount > 0 && (
            <Link
              href="/alerts"
              className="relative p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label={`${alertCount} operational alerts`}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
            </Link>
          )}
        </div>
      </header>

      {/* Sidebar (Desktop Viewport Locked + Mobile Off-canvas Drawer) */}
      <Suspense
        fallback={
          <aside className="hidden lg:block w-64 bg-slate-900 h-screen sticky top-0 border-r border-slate-800 shrink-0" />
        }
      >
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      </Suspense>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
