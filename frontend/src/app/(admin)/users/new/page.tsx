'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useCreateUser } from '@/features/users/hooks';
import { USER_ROLE } from '@/lib/enums';
import { ApiError } from '@/lib/api/api-error';

export default function NewUserPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<string>(USER_ROLE.RETAILER);
  const [phone, setPhone] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; requestId?: string } | null>(null);

  // Success Modal State for showing temporary password once
  const [createdUserModal, setCreatedUserModal] = useState<{
    isOpen: boolean;
    username: string;
    temporaryPassword: string;
  }>({
    isOpen: false,
    username: '',
    temporaryPassword: '',
  });

  const [copied, setCopied] = useState(false);

  const createUserMutation = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    try {
      const res = await createUserMutation.mutateAsync({
        username,
        role: role as 'RETAILER' | 'DELIVERY',
        phone,
        temporaryPassword: customPassword || undefined,
      });

      setCreatedUserModal({
        isOpen: true,
        username: res.user.username,
        temporaryPassword: res.temporaryPassword,
      });
      setCopied(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorDetails({
          message: err.message,
          requestId: err.requestId,
        });
      } else {
        setErrorDetails({
          message: 'An error occurred while creating the user account.',
        });
      }
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(createdUserModal.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    setCreatedUserModal({ isOpen: false, username: '', temporaryPassword: '' });
    router.push('/users');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New User</h1>
          <p className="text-sm text-slate-500 mt-1">
            Provision a new partner account for a Retailer or Delivery agent.
          </p>
        </div>
        <Link href="/users">
          <Button variant="outline" size="sm">
            ← Back to Directory
          </Button>
        </Link>
      </div>

      {errorDetails && (
        <ErrorBanner
          message={errorDetails.message}
          requestId={errorDetails.requestId}
        />
      )}

      {/* Creation Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="create-username"
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. apollo_pharmacy or delivery_agent_01"
            helperText="3-50 alphanumeric characters (dots, hyphens, underscores permitted)."
          />

          <Select
            id="create-role"
            label="Account Role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: USER_ROLE.RETAILER, label: 'Retailer (Licensed Pharmacy)' },
              { value: USER_ROLE.DELIVERY, label: 'Delivery Partner' },
            ]}
          />

          <Input
            id="create-phone"
            label="Phone Number"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            helperText="10-digit Indian mobile number."
          />

          <Input
            id="create-custom-password"
            label="Custom Temporary Password (Optional)"
            type="text"
            value={customPassword}
            onChange={(e) => setCustomPassword(e.target.value)}
            placeholder="Leave blank to auto-generate a memorable passphrase"
            helperText="If omitted, the system generates a secure memorable passphrase (e.g. Kandarp-Drug-9281)."
          />

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Link href="/users">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              isLoading={createUserMutation.isPending}
            >
              Create Account
            </Button>
          </div>
        </form>
      </div>

      {/* Temporary Password Reveal Modal */}
      <Modal
        isOpen={createdUserModal.isOpen}
        onClose={handleDone}
        title="User Created Successfully!"
        description={`Account for ${createdUserModal.username} is ready.`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs text-emerald-800 font-semibold mb-2 uppercase tracking-wider">
              Temporary Access Credentials
            </p>
            <p className="text-xs text-slate-600 mb-3">
              This password is shown <strong>only once</strong>. Share it with the user so they can log in and set their permanent password.
            </p>
            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-emerald-300">
              <span className="font-mono font-bold text-slate-900 text-base tracking-wider">
                {createdUserModal.temporaryPassword}
              </span>
              <Button size="sm" variant="outline" onClick={handleCopyPassword}>
                {copied ? '✓ Copied' : 'Copy Password'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleDone}>
              Done & Return to Users
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
