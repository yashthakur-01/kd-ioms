'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  Package,
  History,
  PlusCircle,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';
import { BottomNav, type BottomNavItem } from '@/components/layout/BottomNav';
import { useAuth } from '@/providers/AuthProvider';

interface NavRouteItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const deliveryRoutes: NavRouteItem[] = [
  {
    label: 'Dispatch Pool',
    href: '/delivery/pool',
    icon: <Package className="w-4 h-4" />,
  },
  {
    label: 'Active Deliveries',
    href: '/delivery/orders',
    icon: <Truck className="w-4 h-4" />,
  },
  {
    label: 'Delivery History',
    href: '/delivery/history',
    icon: <History className="w-4 h-4" />,
  },
  {
    label: 'Place Order',
    href: '/delivery/orders/new',
    icon: <PlusCircle className="w-4 h-4" />,
  },
];

function DeliveryLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();

  const isRouteActive = (routeHref: string) => {
    if (!pathname) return false;
    if (routeHref === '/delivery/orders') {
      return (
        pathname === '/delivery/orders' ||
        (pathname.startsWith('/delivery/orders/') && !pathname.startsWith('/delivery/orders/new'))
      );
    }
    return pathname === routeHref || pathname.startsWith(`${routeHref}/`);
  };

  const bottomNavItems: BottomNavItem[] = deliveryRoutes.map((route) => ({
    label: route.label === 'Active Deliveries' ? 'My Orders' : route.label,
    href: route.href,
    icon: route.icon,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-16 sm:pb-0">
      {/* Top Header Navigation */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <Link href="/delivery/orders" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
                KD
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-wide hidden xs:inline">
                Kandarp Drugs
              </span>
            </Link>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Delivery Partner
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            {deliveryRoutes.map((route) => {
              const active = isRouteActive(route.href);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}>
                    {route.icon}
                  </span>
                  <span>{route.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Sign Out */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{user.username}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out of Delivery Account"
              data-testid="delivery-signout-btn"
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-1.5 font-bold transition-all shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav items={bottomNavItems} />
    </div>
  );
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DeliveryLayoutContent>{children}</DeliveryLayoutContent>
    </Suspense>
  );
}
