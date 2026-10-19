'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useRetailers } from '@/features/retailer/hooks';
import type { RetailerRecord, ApprovalStatus } from '@/features/retailer/schema';

type TabStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export default function AdminRetailersPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Query for the active tab list
  const approvalStatusParam: ApprovalStatus | undefined =
    activeTab === 'ALL' ? undefined : (activeTab as ApprovalStatus);

  const { data, isLoading } = useRetailers({
    page,
    pageSize,
    approvalStatus: approvalStatusParam,
    q: search || undefined,
  });

  // Query specifically to get pending review live count badge (D-09)
  const { data: pendingData } = useRetailers({
    approvalStatus: 'PENDING',
    pageSize: 1,
  });

  const retailers: RetailerRecord[] = data?.data || [];
  const pagination = data?.meta?.pagination;
  const pendingCount = pendingData?.meta?.pagination?.totalItems ?? 0;

  const handleTabChange = (tab: TabStatus) => {
    setActiveTab(tab);
    setPage(1);
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Retailer Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and verify retail pharmacy KYC applications, inspect drug license details, and manage onboarding permissions.
        </p>
      </div>

      {/* Filter Tabs Bar (D-09) */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6" aria-label="Retailer Status Tabs">
          <button
            type="button"
            onClick={() => handleTabChange('PENDING')}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'PENDING'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            Pending Review
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('APPROVED')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'APPROVED'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            Approved
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('REJECTED')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'REJECTED'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            Rejected
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ALL')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ALL'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            All Applications
          </button>
        </nav>
      </div>

      {/* Search Input Filter */}
      <div className="max-w-md">
        <Input
          type="search"
          placeholder="Search by shop name, license, or phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Applications Data Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner className="w-8 h-8 text-emerald-600" />
          <p className="text-sm font-medium text-slate-500">Loading retailer queue...</p>
        </div>
      ) : retailers.length === 0 ? (
        <EmptyState
          title="No Retailer Applications Found"
          description="No retailer KYC submissions match the selected status filter. Select another tab or clear your search query to see other applications."
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop &amp; Account</TableHead>
                <TableHead>Drug License</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead>WhatsApp Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retailers.map((retailer) => (
                <TableRow key={retailer.userId}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{retailer.shopName}</div>
                    <div className="text-xs text-slate-400">User: {retailer.username}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {retailer.drugLicenseNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-700">
                      {retailer.gstin || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-800">
                      {retailer.city}, {retailer.state}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-800">{retailer.whatsappNumber}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(retailer.approvalStatus)}</TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">
                      {retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/retailers/${retailer.userId}`}>
                      <Button size="sm" variant="outline">
                        Review Application
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={(newPage) => setPage(newPage)}
            />
          )}
        </div>
      )}
    </div>
  );
}
