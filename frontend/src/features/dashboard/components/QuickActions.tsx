'use client';

import React from 'react';
import Link from 'next/link';

export function QuickActions() {
  const actions = [
    {
      label: 'Receive Inward Stock',
      desc: 'Scan barcode or OCR packaging',
      href: '/stock/inward',
      icon: '📦',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    },
    {
      label: 'Review Retailer KYC',
      desc: 'Approve pending verification queues',
      href: '/retailers',
      icon: '🏪',
      color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    },
    {
      label: 'Manage Expiry Alerts',
      desc: 'Dismiss warnings or write off stock',
      href: '/alerts',
      icon: '⚠️',
      color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    },
    {
      label: 'System & Invoicing Settings',
      desc: 'Configure alert window & GST details',
      href: '/settings',
      icon: '⚙️',
      color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Administrative Quick Actions</h3>
          <p className="text-xs text-slate-500 mt-0.5">Shortcuts for routine warehouse workflows</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((act) => (
          <Link
            key={act.label}
            href={act.href}
            className={`p-4 rounded-xl border transition-all hover:shadow-sm flex items-start gap-3 ${act.color}`}
          >
            <span className="text-2xl">{act.icon}</span>
            <div>
              <div className="text-xs font-bold">{act.label}</div>
              <div className="text-[11px] opacity-80 mt-0.5">{act.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
