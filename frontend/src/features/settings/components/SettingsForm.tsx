'use client';

import React, { useState } from 'react';
import { useSettings, useUpdateSettingsMutation } from '../hooks';
import { settingsFormSchema, type SettingsFormData } from '../schema';
import type { AppSettings } from '../types';
import { Spinner } from '../../../components/ui/Spinner';

interface SettingsFormFieldsProps {
  initialData: AppSettings;
}

function SettingsFormFields({ initialData }: SettingsFormFieldsProps) {
  const updateMutation = useUpdateSettingsMutation();

  const [formData, setFormData] = useState<SettingsFormData>({
    expiryAlertDays: initialData.expiryAlertDays ?? 60,
    businessProfile: {
      name: initialData.businessProfile?.name ?? '',
      address: initialData.businessProfile?.address ?? '',
      gstin: initialData.businessProfile?.gstin ?? '',
      drugLicenseNumber: initialData.businessProfile?.drugLicenseNumber ?? '',
      phone: initialData.businessProfile?.phone ?? '',
      email: initialData.businessProfile?.email ?? '',
      logoPath: initialData.businessProfile?.logoPath ?? null,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setSuccessMessage(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    if (field === 'expiryAlertDays') {
      setFormData((prev) => ({ ...prev, expiryAlertDays: Number(value) }));
    } else {
      setFormData((prev) => ({
        ...prev,
        businessProfile: {
          ...prev.businessProfile,
          [field]: value,
        },
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrors({});

    const result = settingsFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        expiryAlertDays: formData.expiryAlertDays,
        businessProfile: formData.businessProfile,
      });
      setSuccessMessage('System configuration and business profile updated successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update system settings';
      setErrors({ global: message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <span className="font-bold">✓ Success:</span>
          <span>{successMessage}</span>
        </div>
      )}

      {errors.global && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <span className="font-bold">Error:</span>
          <span>{errors.global}</span>
        </div>
      )}

      {/* Card 1: Warehouse Operations */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Warehouse Expiry Alert Rules</h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure alerting thresholds for inventory approaching expiration.</p>
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expiry Alert Window (Days)
          </label>
          <input
            type="number"
            min={1}
            max={730}
            value={formData.expiryAlertDays}
            onChange={(e) => handleChange('expiryAlertDays', e.target.value)}
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          {errors.expiryAlertDays && (
            <p className="text-[11px] text-rose-600 mt-1">{errors.expiryAlertDays}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            Batches expiring within this window will appear under Near Expiry alerts and trigger navigation badges.
          </p>
        </div>
      </div>

      {/* Card 2: Business & Billing Profile */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Business & Billing Identity</h3>
          <p className="text-xs text-slate-500 mt-0.5">Official wholesale details rendered on tax invoices, delivery challans, and retailer communications.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Business Name</label>
            <input
              type="text"
              value={formData.businessProfile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            {errors['businessProfile.name'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.name']}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
            <input
              type="text"
              value={formData.businessProfile.gstin}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
              placeholder="e.g. 24AAAAA0000A1Z5"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-slate-400"
            />
            {errors['businessProfile.gstin'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.gstin']}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Drug License Number</label>
            <input
              type="text"
              value={formData.businessProfile.drugLicenseNumber}
              onChange={(e) => handleChange('drugLicenseNumber', e.target.value)}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            {errors['businessProfile.drugLicenseNumber'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.drugLicenseNumber']}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Support Phone</label>
            <input
              type="text"
              value={formData.businessProfile.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+919876543210"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-slate-400"
            />
            {errors['businessProfile.phone'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.phone']}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Billing Email</label>
            <input
              type="email"
              value={formData.businessProfile.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="billing@kandarpdrugs.com"
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-slate-400"
            />
            {errors['businessProfile.email'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.email']}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Warehouse & Office Address</label>
            <textarea
              rows={2}
              value={formData.businessProfile.address}
              onChange={(e) => handleChange('address', e.target.value)}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-white text-black !text-black border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            {errors['businessProfile.address'] && (
              <p className="text-[11px] text-rose-600 mt-1">{errors['businessProfile.address']}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          {updateMutation.isPending ? <Spinner size="sm" /> : null}
          Save System Settings
        </button>
      </div>
    </form>
  );
}

export function SettingsForm() {
  const { data, isLoading } = useSettings();

  if (isLoading || !data?.data) {
    return (
      <div className="py-20 text-center">
        <Spinner size="lg" />
        <p className="text-xs text-slate-500 mt-2">Loading system settings...</p>
      </div>
    );
  }

  return <SettingsFormFields initialData={data.data} />;
}
