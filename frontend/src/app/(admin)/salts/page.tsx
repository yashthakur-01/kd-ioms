'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { Spinner } from '../../../components/ui/Spinner';
import { useSalts } from '../../../features/salts/hooks';
import { SaltTable } from '../../../features/salts/components/SaltTable';
import { AddSaltModal } from '../../../features/salts/components/AddSaltModal';
import { EditSaltModal } from '../../../features/salts/components/EditSaltModal';
import type { SaltRecord } from '../../../features/salts/types';

export default function SaltsMasterPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSalt, setEditingSalt] = useState<SaltRecord | null>(null);

  const { data, isLoading, isError } = useSalts({
    page,
    pageSize,
    q: searchTerm.trim() || undefined,
    isActive: statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined,
    sort: 'saltName:asc',
  });

  const salts = data?.data || [];
  const pagination = data?.meta?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Salts Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage standardized pharmaceutical salts, collision warnings, and formula associations.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          + Add Salt
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search salt by name..."
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-medium">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setStatusFilter(filter);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === filter
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200 text-xs">
          Failed to load salts master list. Please try again later.
        </div>
      ) : (
        <>
          <SaltTable salts={salts} onEdit={(salt) => setEditingSalt(salt)} />

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

      {/* Modals */}
      <AddSaltModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <EditSaltModal
        salt={editingSalt}
        isOpen={editingSalt !== null}
        onClose={() => setEditingSalt(null)}
      />
    </div>
  );
}
