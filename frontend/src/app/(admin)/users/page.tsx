'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { useUsers, useUpdateUser, useResetPassword } from '@/features/users/hooks';
import type { UserRecord } from '@/features/users/api';
import { USER_ROLE } from '@/lib/enums';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Password Reset Modal State
  const [resetModalData, setResetModalData] = useState<{
    isOpen: boolean;
    username: string;
    temporaryPassword?: string;
  }>({ isOpen: false, username: '' });

  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    q: search || undefined,
    role: roleFilter || undefined,
    isActive: statusFilter ? statusFilter === 'true' : undefined,
  });

  const updateUserMutation = useUpdateUser();
  const resetPasswordMutation = useResetPassword();

  const users: UserRecord[] = data?.data || [];
  const pagination = data?.meta?.pagination;

  const handleToggleStatus = async (user: UserRecord) => {
    await updateUserMutation.mutateAsync({
      userId: user.id,
      payload: { isActive: !user.isActive },
    });
  };

  const handleResetPassword = async (user: UserRecord) => {
    try {
      const res = await resetPasswordMutation.mutateAsync(user.id);
      setResetModalData({
        isOpen: true,
        username: user.username,
        temporaryPassword: res.temporaryPassword,
      });
      setCopied(false);
    } catch {
      // Handled by toast in mutation
    }
  };

  const handleCopyPassword = () => {
    if (resetModalData.temporaryPassword) {
      navigator.clipboard.writeText(resetModalData.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage system access, create accounts, and control credentials for Retailers and Delivery partners.
          </p>
        </div>
        <Link href="/users/new">
          <Button variant="primary">
            + Create New User
          </Button>
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Input
          placeholder="Search by username or phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Roles' },
            { value: USER_ROLE.ADMIN, label: 'Admin' },
            { value: USER_ROLE.RETAILER, label: 'Retailer' },
            { value: USER_ROLE.DELIVERY, label: 'Delivery Partner' },
          ]}
        />

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'true', label: 'Active Only' },
            { value: 'false', label: 'Inactive Only' },
          ]}
        />
      </div>

      {/* Users Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Password State</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell className="text-center py-8 text-slate-400">Loading user directory...</TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell className="text-center py-8 text-slate-400">No users match the criteria.</TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-semibold text-slate-900">{u.username}</div>
                  <div className="text-xs text-slate-400 font-mono">{u.id}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      u.role === 'ADMIN' ? 'info' : u.role === 'RETAILER' ? 'success' : 'warning'
                    }
                  >
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{u.phone}</TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'success' : 'danger'}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.mustChangePassword ? (
                    <Badge variant="warning">Must Change</Badge>
                  ) : (
                    <Badge variant="neutral">Verified</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {u.role !== 'ADMIN' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(u)}
                        isLoading={updateUserMutation.isPending}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(u)}
                      isLoading={resetPasswordMutation.isPending}
                    >
                      Reset Password
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModalData.isOpen}
        onClose={() => setResetModalData({ isOpen: false, username: '' })}
        title="Temporary Password Generated"
        description={`A new temporary password was generated for ${resetModalData.username}.`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 font-medium mb-2">
              Important: This temporary password is only shown once. Copy and share it securely with the user.
            </p>
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-amber-200">
              <span className="font-mono font-bold text-slate-900 tracking-wider">
                {resetModalData.temporaryPassword}
              </span>
              <Button size="sm" variant="outline" onClick={handleCopyPassword}>
                {copied ? '✓ Copied' : 'Copy Password'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            The user will be required to change this password on their next login attempt.
          </p>
        </div>
      </Modal>
    </div>
  );
}
