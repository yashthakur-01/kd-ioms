'use client';

import React from 'react';
import type { CatalogItem } from '../catalog.api';
import { MedicineCatalogCard } from './MedicineCatalogCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PackageSearch } from 'lucide-react';

interface MedicineCatalogGridProps {
  medicines: CatalogItem[];
  isLoading: boolean;
  onResetFilters: () => void;
}

export function MedicineCatalogGrid({
  medicines,
  isLoading,
  onResetFilters,
}: MedicineCatalogGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse space-y-4"
          >
            <div className="space-y-2">
              <div className="h-5 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3.5 bg-slate-100 rounded-md w-1/2" />
            </div>
            <div className="h-10 bg-slate-100 rounded-lg w-full" />
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="h-6 bg-slate-200 rounded-md w-1/3" />
              <div className="h-5 bg-slate-100 rounded-full w-1/4" />
            </div>
            <div className="h-9 bg-slate-200 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
        <EmptyState
          icon={<PackageSearch className="w-12 h-12 text-slate-400 mx-auto mb-3" />}
          title="No medicines found"
          description="We couldn't find any products matching your search criteria or availability filter."
          action={
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
            >
              Reset All Filters
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {medicines.map((medicine) => (
        <MedicineCatalogCard key={medicine.medicineId} medicine={medicine} />
      ))}
    </div>
  );
}
