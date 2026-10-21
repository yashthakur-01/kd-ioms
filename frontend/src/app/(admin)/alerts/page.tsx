'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNearExpiryAlerts, useExpiredStockAlerts } from '../../../features/alerts/hooks';
import { NearExpiryTable } from '../../../features/alerts/components/NearExpiryTable';
import { ExpiredStockTable } from '../../../features/alerts/components/ExpiredStockTable';
import { OutOfStockTable } from '../../../features/alerts/components/OutOfStockTable';
import { Spinner } from '../../../components/ui/Spinner';

type AlertTab = 'near-expiry' | 'expired' | 'out-of-stock';

function AlertsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = (searchParams.get('tab') as AlertTab) || 'near-expiry';
  const [activeTab, setActiveTab] = useState<AlertTab>(tabParam);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data: nearData, isLoading: nearLoading } = useNearExpiryAlerts({
    page,
    pageSize: 20,
    search: searchTerm || undefined,
  });

  const { data: expData, isLoading: expLoading } = useExpiredStockAlerts({
    page,
    pageSize: 20,
    search: searchTerm || undefined,
  });

  const handleTabChange = (tab: AlertTab) => {
    setActiveTab(tab);
    setPage(1);
    router.push(`/alerts?tab=${tab}`, { scroll: false });
  };

  const nearTotal = nearData?.meta?.pagination?.totalItems ?? nearData?.data?.length ?? 0;
  const expTotal = expData?.meta?.pagination?.totalItems ?? expData?.data?.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory & Expiry Alerts"
        description="Daily operational monitoring for nearing expiry batches, expired shelf inventory, and depleted stock."
      />

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange('near-expiry')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'near-expiry'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
          >
            Near Expiry
            {nearTotal > 0 ? (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'near-expiry' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                {nearTotal}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => handleTabChange('expired')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'expired'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
          >
            Expired Stock
            {expTotal > 0 ? (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'expired' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                {expTotal}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => handleTabChange('out-of-stock')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'out-of-stock'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
          >
            Out of Stock
          </button>
        </div>

        {activeTab !== 'out-of-stock' && (
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search medicine or batch..."
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === 'near-expiry' && (
        <NearExpiryTable items={nearData?.data || []} isLoading={nearLoading} />
      )}

      {activeTab === 'expired' && (
        <ExpiredStockTable items={expData?.data || []} isLoading={expLoading} />
      )}

      {activeTab === 'out-of-stock' && (
        <OutOfStockTable />
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 mt-2">Loading alerts center...</p>
        </div>
      }
    >
      <AlertsContent />
    </Suspense>
  );
}
