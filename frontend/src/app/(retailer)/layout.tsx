'use client';

import React, { useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav, type BottomNavItem } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { useRetailerProfile } from '@/features/retailer/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { LogOut } from 'lucide-react';
import type { ApprovalStatus } from '@/features/retailer/schema';

function RetailerLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const { isApproved, approvalStatus, isLoading } = useRetailerProfile({
    enabled: user?.role === 'RETAILER',
  });
  const { showToast, showSuccess } = useToast();
  const previousStatusRef = useRef<ApprovalStatus | null>(null);

  // Celebratory toast on live status transition PENDING -> APPROVED (D-16)
  useEffect(() => {
    if (isAuthLoading || !user || user.role !== 'RETAILER') return;
    if (previousStatusRef.current === 'PENDING' && approvalStatus === 'APPROVED') {
      showSuccess('🎉 Your KYC is approved! Catalog access is now unlocked.');
    }
    if (approvalStatus) {
      previousStatusRef.current = approvalStatus;
    }
  }, [approvalStatus, isAuthLoading, showSuccess, user]);

  // Route gating: unapproved retailers redirected to /profile on gated routes (D-01, D-03)
  useEffect(() => {
    if (isAuthLoading || !user || user.role !== 'RETAILER') return;
    if (!isLoading && !isApproved && pathname && pathname !== '/profile') {
      showToast({
        type: 'warning',
        title: 'KYC Verification Required',
        message: 'Your profile must be approved by Kandarp Drugs administration before accessing the catalog or placing orders.',
      });
      router.replace('/profile');
    }
  }, [isAuthLoading, isLoading, isApproved, pathname, router, showToast, user]);

  const navItems: BottomNavItem[] = [
    {
      label: 'Catalog',
      href: '/catalog',
      disabled: !isApproved,
      lockBadge: !isApproved,
      disabledTooltip: 'KYC Approval Required to browse catalog',
    },
    {
      label: 'Cart',
      href: '/cart',
      disabled: !isApproved,
      lockBadge: !isApproved,
      disabledTooltip: 'KYC Approval Required to access cart',
    },
    {
      label: 'Orders',
      href: '/orders',
      disabled: !isApproved,
      lockBadge: !isApproved,
      disabledTooltip: 'KYC Approval Required to view orders',
    },
    {
      label: 'Profile',
      href: '/profile',
      disabled: false,
    },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && user.role === 'ADMIN') {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <Suspense fallback={<aside className="w-64 bg-slate-900 min-h-screen border-r border-slate-800" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">{children}</main>
      </div>
    );
  }

  if (user && user.role !== 'RETAILER') {
    return <div className="min-h-screen bg-slate-50 flex flex-col">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 sm:pb-0">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm tracking-wide">Kandarp Drugs</span>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Retailer Portal
            </span>
          </div>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
                    title={item.disabledTooltip}
                  >
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {approvalStatus && (
            <div className="text-xs">
              {approvalStatus === 'APPROVED' && (
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Verified
                </span>
              )}
              {approvalStatus === 'PENDING' && (
                <span className="text-amber-700 bg-amber-50 border border-amber-200 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Under Review
                </span>
              )}
              {approvalStatus === 'REJECTED' && (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Action Required
                </span>
              )}
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="hidden sm:inline-block text-xs font-medium text-slate-700">
                {user.username}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                data-testid="retailer-layout-logout-btn"
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1 font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</div>}>
      <RetailerLayoutContent>{children}</RetailerLayoutContent>
    </Suspense>
  );
}
