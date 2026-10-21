'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Building2, User, Phone, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchRetailers, type RetailerRecord } from '@/features/retailer/api';
import { CartCheckoutView } from '@/features/cart/CartCheckoutView';

export default function DeliveryNewOrderPage() {
  const [retailers, setRetailers] = useState<RetailerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<{
    userId: string;
    pharmacyName: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    fetchRetailers({
      approvalStatus: 'APPROVED',
      q: searchQuery.trim() || undefined,
      pageSize: 50,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setRetailers(res.data);
        } else {
          setRetailers([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load approved retailers', err);
        setError(err?.message || 'Failed to load approved pharmacies. Please try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchQuery, refreshIndex]);

  if (selectedRetailer) {
    return (
      <div className="space-y-4">
        {/* Sticky Context Bar */}
        <div className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              OB
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                On-Behalf Context Active
              </span>
              <span className="font-bold text-sm">
                Pharmacy: {selectedRetailer.pharmacyName}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedRetailer(null)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            Change Pharmacy
          </button>
        </div>

        <CartCheckoutView
          onBehalfRetailerId={selectedRetailer.userId}
          onBehalfPharmacyName={selectedRetailer.pharmacyName}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/delivery/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Delivery Dashboard
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Select Pharmacy for Order
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Choose an approved pharmacy partner to create an order and reserve inventory on their behalf.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by pharmacy name, owner, or contact..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-black !text-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm placeholder:text-slate-400"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshIndex((i) => i + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Retailers List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading approved pharmacies...</div>
      ) : retailers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">No Approved Pharmacies</h3>
          <p className="text-xs text-slate-500">
            {searchQuery ? 'No pharmacies matched your search query.' : 'There are no KYC-approved pharmacies available.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {retailers.map((r) => (
            <div
              key={r.userId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {r.shopName}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Approved
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {r.username}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {r.whatsappNumber || r.userPhone}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRetailer({
                    userId: r.userId,
                    pharmacyName: r.shopName,
                  })
                }
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Select & Create Order
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
