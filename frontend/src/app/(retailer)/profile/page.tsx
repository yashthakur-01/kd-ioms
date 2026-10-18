'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useRetailerProfile, useUpsertProfile } from '@/features/retailer/hooks';
import { ApiError } from '@/lib/api/api-error';
import {
  retailerProfileFormSchema,
  type RetailerProfileFormData,
  type RetailerProfile,
} from '@/features/retailer/schema';

export default function RetailerProfilePage() {
  const {
    profile,
    approvalStatus,
    isApproved,
    isPending,
    isRejected,
    isUnsubmitted,
    isLoading,
    isFetching,
    refetch,
  } = useRetailerProfile();

  const upsertMutation = useUpsertProfile();

  // Form state
  const [formData, setFormData] = useState<RetailerProfileFormData>({
    shopName: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
    whatsappNumber: '',
    email: '',
    drugLicenseNumber: '',
    gstin: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Sync form when profile is loaded (especially for REJECTED state resubmission)
  useEffect(() => {
    if (profile) {
      setFormData({
        shopName: profile.shopName || '',
        addressLine: profile.addressLine || '',
        city: profile.city || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
        whatsappNumber: profile.whatsappNumber || '',
        email: profile.email || '',
        drugLicenseNumber: profile.drugLicenseNumber || '',
        gstin: profile.gstin || '',
      });
    }
  }, [profile]);

  const handleCopy = (field: string, value: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleInputChange = (field: keyof RetailerProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setGeneralError(null);

    // Validate using Zod schema
    const result = retailerProfileFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const pathKey = issue.path[0] as string;
        if (!fieldErrors[pathKey]) {
          fieldErrors[pathKey] = issue.message;
        }
      }
      setFormErrors(fieldErrors);
      return;
    }

    try {
      await upsertMutation.mutateAsync(result.data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.errors && err.errors.length > 0) {
          const apiFieldErrors: Record<string, string> = {};
          for (const item of err.errors) {
            if (item.field) {
              if (item.field === 'drugLicenseNumber') {
                apiFieldErrors.drugLicenseNumber =
                  'Drug license number is already registered with another account. Please verify your license or contact support.';
              } else if (item.field === 'gstin') {
                apiFieldErrors.gstin =
                  'GSTIN is already registered with another account. Please check the entered number or contact support.';
              } else {
                apiFieldErrors[item.field] = item.message;
              }
            }
          }
          setFormErrors(apiFieldErrors);
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('An unexpected error occurred while saving your profile. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner className="w-8 h-8 text-emerald-600" />
        <p className="text-sm font-medium text-slate-500">Loading profile details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Retailer KYC Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your pharmacy business details, licensing credentials, and account verification status.
        </p>
      </div>

      {/* PENDING State Alert Card */}
      {isPending && (
        <div
          data-testid="pending-banner"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Application Under Review</h3>
              <p className="text-sm text-amber-800 mt-1">
                Our compliance team is verifying your drug license and pharmacy credentials. You will be
                notified once your account is activated.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-start sm:self-center shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100/60"
          >
            {isFetching ? <Spinner className="w-4 h-4 mr-2 text-amber-800" /> : null}
            Check Verification Status
          </Button>
        </div>
      )}

      {/* REJECTED State Alert Card */}
      {isRejected && (
        <div
          data-testid="rejected-banner"
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 space-y-2"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="font-semibold text-rose-950 text-base">Application Needs Attention</h3>
          </div>
          <div className="bg-white/80 border border-rose-200/80 rounded-lg p-3 text-sm">
            <span className="font-semibold text-rose-950 block text-xs uppercase tracking-wider mb-1">
              Admin Review Remarks:
            </span>
            <p className="text-rose-900">{profile?.rejectionReason || 'Details require revision.'}</p>
          </div>
          <p className="text-xs text-rose-800">
            Please correct the flagged discrepancies in the form below and resubmit for verification.
          </p>
        </div>
      )}

      {/* APPROVED State Alert Card */}
      {isApproved && (
        <div
          data-testid="approved-banner"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">Account Verified</h3>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-sm text-emerald-800 mt-1">
                Your pharmacy credentials are approved. You have full access to browse medicines, view wholesale rates,
                and place orders.
              </p>
            </div>
          </div>
          <Link href="/catalog" className="self-start sm:self-center shrink-0">
            <Button type="button" variant="primary" size="md">
              Browse Catalog &amp; Order
            </Button>
          </Link>
        </div>
      )}

      {/* General Form Error Banner */}
      {generalError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          {generalError}
        </div>
      )}

      {/* View Mode: Read-Only Inspector for PENDING and APPROVED */}
      {(isPending || isApproved) && profile && (
        <ReadOnlyInspector
          profile={profile}
          approvalStatus={approvalStatus!}
          copiedField={copiedField}
          onCopy={handleCopy}
        />
      )}

      {/* Edit Mode: Active Form for UN-SUBMITTED and REJECTED */}
      {(isUnsubmitted || isRejected) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {isRejected ? 'Update & Resubmit Pharmacy Details' : 'Pharmacy & Licensing Information'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All information must match your official Drug License and state pharmacy registrations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Pharmacy / Shop Name" required error={formErrors.shopName}>
                  <Input
                    type="text"
                    placeholder="e.g. Shree Krishna Medical Stores"
                    value={formData.shopName}
                    onChange={(e) => handleInputChange('shopName', e.target.value)}
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Shop Address" required error={formErrors.addressLine}>
                  <Input
                    type="text"
                    placeholder="Shop No., Street, Landmark"
                    value={formData.addressLine}
                    onChange={(e) => handleInputChange('addressLine', e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="City" required error={formErrors.city}>
                  <Input
                    type="text"
                    placeholder="Ahmedabad"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="State" required error={formErrors.state}>
                  <Input
                    type="text"
                    placeholder="Gujarat"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="Pincode (6 digits)" required error={formErrors.pincode}>
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="380001"
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="WhatsApp Mobile Number" required error={formErrors.whatsappNumber}>
                  <Input
                    type="text"
                    placeholder="9876543210 or +919876543210"
                    value={formData.whatsappNumber}
                    onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Email Address (Optional)" error={formErrors.email}>
                  <Input
                    type="email"
                    placeholder="chemist@example.com"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="Drug License Number" required error={formErrors.drugLicenseNumber}>
                  <Input
                    type="text"
                    placeholder="e.g. GJ-AH1-123456"
                    value={formData.drugLicenseNumber}
                    onChange={(e) => handleInputChange('drugLicenseNumber', e.target.value.toUpperCase())}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="GSTIN (Optional 15 chars)" error={formErrors.gstin}>
                  <Input
                    type="text"
                    maxLength={15}
                    placeholder="24AAAAA0000A1Z5"
                    value={formData.gstin || ''}
                    onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                  />
                </FormField>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={upsertMutation.isPending}
                className="w-full sm:w-auto"
              >
                {isRejected ? 'Resubmit for Review' : 'Submit Profile for Verification'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

interface ReadOnlyInspectorProps {
  profile: RetailerProfile;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
}

function ReadOnlyInspector({ profile, approvalStatus, copiedField, onCopy }: ReadOnlyInspectorProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{profile.shopName}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Submitted KYC Profile Details</p>
        </div>
        <div className="self-start sm:self-auto">
          {approvalStatus === 'APPROVED' ? (
            <Badge variant="success">Approved &amp; Verified</Badge>
          ) : (
            <Badge variant="warning">Pending Verification</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
        <div>
          <span className="block text-xs font-medium text-slate-500">Shop / Establishment Name</span>
          <span className="font-semibold text-slate-900">{profile.shopName}</span>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">Address Line</span>
          <span className="text-slate-800">{profile.addressLine}</span>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">City, State &amp; Pincode</span>
          <span className="text-slate-800">
            {profile.city}, {profile.state} — {profile.pincode}
          </span>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">WhatsApp Contact</span>
          <span className="text-slate-800 font-mono">{profile.whatsappNumber}</span>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">Email Address</span>
          <span className="text-slate-800">{profile.email || '—'}</span>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">Drug License Number</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono font-semibold text-slate-900">{profile.drugLicenseNumber}</span>
            <button
              type="button"
              onClick={() => onCopy('license', profile.drugLicenseNumber)}
              className="text-xs text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded px-2 py-0.5 transition-colors"
              title="Copy Drug License Number"
            >
              {copiedField === 'license' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">GSTIN</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-slate-900">{profile.gstin || '—'}</span>
            {profile.gstin && (
              <button
                type="button"
                onClick={() => onCopy('gstin', profile.gstin!)}
                className="text-xs text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded px-2 py-0.5 transition-colors"
                title="Copy GSTIN"
              >
                {copiedField === 'gstin' ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500">Submitted On</span>
          <span className="text-slate-700">
            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>

      {approvalStatus === 'APPROVED' && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex items-start gap-3 mt-4 text-xs text-slate-600">
          <svg className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <div>
            <span className="font-semibold text-slate-800 block mb-0.5">Verified Profile Lock</span>
            Verified KYC details are locked against direct edits. If your drug license or shop details have
            changed, please contact Kandarp Drugs support at{' '}
            <a href="mailto:support@kandarpgroups.com" className="text-emerald-600 underline">
              support@kandarpgroups.com
            </a>{' '}
            or call +91-9876543210.
          </div>
        </div>
      )}
    </div>
  );
}
