'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useDashboardSummary } from '../../../features/dashboard/hooks';
import { DashboardSummaryCards } from '../../../features/dashboard/components/DashboardSummaryCards';
import { QuickActions } from '../../../features/dashboard/components/QuickActions';

export default function AdminDashboardPage() {
  const { data, isLoading, isFetching, refetch } = useDashboardSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Admin Operations Dashboard"
          description="Real-time warehouse operational summary, queue metrics, and alert monitoring"
        />

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg shadow-sm transition-all flex items-center gap-1.5 self-end sm:self-auto"
        >
          <span className={isFetching ? 'animate-spin' : ''}>🔄</span>
          {isFetching ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {/* 8 Live Metric Cards */}
      <DashboardSummaryCards
        summary={data?.data || null}
        isLoading={isLoading}
      />

      {/* Administrative Quick Shortcuts */}
      <QuickActions />
    </div>
  );
}
