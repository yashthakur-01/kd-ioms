'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  lockBadge?: boolean;
}

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 sm:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                title={item.disabledTooltip || 'Locked: KYC Approval Required'}
                aria-disabled="true"
                data-testid={`bottom-nav-${item.label.toLowerCase()}-locked`}
                className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1 text-xs font-medium text-slate-400 opacity-60 cursor-not-allowed select-none relative"
              >
                <div className="relative">
                  {item.icon}
                  {item.lockBadge && (
                    <span aria-label="Locked" className="inline-block">
                      <svg
                        className="w-3.5 h-3.5 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <span className="mt-0.5">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
