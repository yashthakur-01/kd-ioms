'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav, type BottomNavItem } from '@/components/layout/BottomNav';
import { useRetailerProfile } from '@/features/retailer/hooks';
import { useToast } from '@/providers/ToastProvider';
import type { ApprovalStatus } from '@/features/retailer/schema';

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isApproved, approvalStatus, isLoading } = useRetailerProfile();
  const { showToast, showSuccess } = useToast();
  const previousStatusRef = useRef<ApprovalStatus | null>(null);

  // Celebratory toast on live status transition PENDING -> APPROVED (D-16)
  useEffect(() => {
    if (previousStatusRef.current === 'PENDING' && approvalStatus === 'APPROVED') {
      showSuccess('🎉 Your KYC is approved! Catalog access is now unlocked.');
    }
    if (approvalStatus) {
      previousStatusRef.current = approvalStatus;
    }
  }, [approvalStatus, showSuccess]);

  // Route gating: unapproved retailers redirected to /profile on gated routes (D-01, D-03)
  useEffect(() => {
    if (!isLoading && !isApproved && pathname && pathname !== '/profile') {
      showToast({
        type: 'warning',
        title: 'KYC Verification Required',
        message: 'Your profile must be approved by Kandarp Drugs administration before accessing the catalog or placing orders.',
      });
      router.replace('/profile');
    }
  }, [isLoading, isApproved, pathname, router, showToast]);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 sm:pb-0">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm tracking-wide">Kandarp Drugs</span>
          <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Retailer Portal
          </span>
        </div>
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
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
