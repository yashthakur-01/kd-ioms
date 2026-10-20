'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { useAlertsBadgeCount } from '../../features/alerts/hooks';

interface NavItem {
  label: string;
  href: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Users', href: '/users' },
  { label: 'Retailers', href: '/retailers' },
  { label: 'Salts Master', href: '/salts' },
  { label: 'Medicines', href: '/medicines' },
  { label: 'Stock Inward', href: '/stock/inward' },
  { label: 'Batches', href: '/batches' },
  { label: 'Orders Queue', href: '/orders' },
  { label: 'Tax Invoices', href: '/invoices' },
  { label: 'Alerts', href: '/alerts' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { data: alertCount } = useAlertsBadgeCount();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen border-r border-slate-800">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="font-bold text-white text-base tracking-wide">KD-IOMS</span>
          <span className="block text-xs text-emerald-400 font-medium">Wholesale Admin</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const isAlert = item.href === '/alerts';
          const showAlertBadge = isAlert && typeof alertCount === 'number' && alertCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {showAlertBadge && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm">
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-400 mb-2 truncate">
          Signed in as <span className="font-semibold text-slate-200">{user?.username || 'Admin'}</span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-rose-400 hover:text-rose-300 font-medium py-1 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
