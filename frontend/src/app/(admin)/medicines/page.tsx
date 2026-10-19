'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { Spinner } from '../../../components/ui/Spinner';
import { useMedicines } from '../../../features/medicines/hooks';
import { useSalts } from '../../../features/salts/hooks';
import { MedicineTable } from '../../../features/medicines/components/MedicineTable';
import type { SaltRecord } from '../../../features/salts/types';

export default function MedicinesDirectoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaltId, setSelectedSaltId] = useState<number | undefined>(undefined);
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState('name:asc');

  // Load salts for filter dropdown
  const { data: saltsData } = useSalts({ isActive: true, pageSize: 100 });
  const salts: SaltRecord[] = saltsData?.data || [];

  const { data, isLoading, isError } = useMedicines({
    page,
    pageSize,
    q: searchTerm.trim() || undefined,
    saltId: selectedSaltId,
    company: companyFilter.trim() || undefined,
    isActive: statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined,
    sort: sortBy,
  });

  const medicines = data?.data || [];
  const pagination = data?.meta?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Medicine Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage pharmaceutical brand catalog, packaging, tax rates, and active ingredients.
          </p>
        </div>
        <Link href="/medicines/new">
          <Button>
            + Add Medicine
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="sm:col-span-2">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by brand name or salt formula..."
            />
          </div>

          {/* Salt Dropdown Filter */}
          <div>
            <select
              value={selectedSaltId || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                setSelectedSaltId(val);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              <option value="">All Salts (Filter)</option>
              {salts.map((s) => (
                <option key={s.saltId} value={s.saltId}>
                  {s.saltName}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div>
            <Input
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter company..."
            />
          </div>
        </div>

        {/* Secondary Filter Row: Status & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === filter
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="company:asc">Company (A-Z)</option>
              <option value="createdAt:desc">Recently Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200 text-xs">
          Failed to load medicines directory. Please try again later.
        </div>
      ) : (
        <>
          <MedicineTable medicines={medicines} />

          {pagination && (pagination.totalPages ?? 1) > 1 && (
            <div className="pt-2">
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
