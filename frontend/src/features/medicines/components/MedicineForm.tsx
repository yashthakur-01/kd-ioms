import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ErrorBanner } from '../../../components/feedback/ErrorBanner';
import { SaltChipSelector } from './SaltChipSelector';
import { GST_SLAB, type GstSlab } from '../../../lib/enums/gst-slab.enum';
import type { MedicineRecord, CreateMedicinePayload, UpdateMedicinePayload } from '../types';
import { ApiError } from '../../../lib/api/api-error';

interface MedicineFormProps {
  initialData?: MedicineRecord;
  onSubmit: (payload: CreateMedicinePayload | UpdateMedicinePayload) => Promise<void>;
  isLoading?: boolean;
}

export function MedicineForm({ initialData, onSubmit, isLoading = false }: MedicineFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [company, setCompany] = useState(initialData?.company || '');
  const [packSize, setPackSize] = useState(initialData?.packSize || '');
  const [gstRate, setGstRate] = useState<number>(
    initialData ? parseFloat(initialData.gstRate) : 12
  );
  const [saltIds, setSaltIds] = useState<number[]>(initialData?.saltIds || []);
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive !== undefined ? initialData.isActive : true
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRef, setErrorRef] = useState<string | undefined>(undefined);

  const isEdit = Boolean(initialData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorRef(undefined);

    if (!name.trim()) {
      setErrorMessage('Medicine name is required.');
      return;
    }

    if (!company.trim()) {
      setErrorMessage('Company / Manufacturer name is required.');
      return;
    }

    if (gstRate < 0 || gstRate > 40) {
      setErrorMessage('GST rate must be between 0% and 40%.');
      return;
    }

    try {
      if (isEdit) {
        await onSubmit({
          name: name.trim(),
          company: company.trim(),
          packSize: packSize.trim(),
          gstRate,
          saltIds,
          isActive,
        });
      } else {
        await onSubmit({
          name: name.trim(),
          company: company.trim(),
          packSize: packSize.trim(),
          gstRate,
          saltIds,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorRef(err.requestId);
      } else {
        setErrorMessage('Failed to save medicine record. Please review form fields.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
      {errorMessage && (
        <ErrorBanner message={errorMessage} requestId={errorRef} />
      )}

      {/* Basic Identification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Brand / Medicine Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Augmentin 625 Duo, Dolo 650"
            required
          />
        </FormField>

        <FormField label="Manufacturer / Company" required>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. GSK, Micro Labs, Cipla"
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Packaging / Unit Size">
          <Input
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            placeholder="e.g. 10 Tablets, 100ml Bottle, 1 Injection"
          />
        </FormField>

        {/* GST Rate Selector with quick-slab pills */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            GST Tax Slab Rate (%)
          </label>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {GST_SLAB.map((slab: GstSlab) => (
              <button
                key={slab}
                type="button"
                onClick={() => setGstRate(slab)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  gstRate === slab
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {slab}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              max="40"
              value={gstRate}
              onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="w-32 px-3 py-1.5 text-xs bg-white text-black !text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <span className="text-xs text-slate-400">Custom rate (0.00% to 40.00%)</span>
          </div>
        </div>
      </div>

      {/* Associated Salts with Hybrid Selector */}
      <div className="pt-2 border-t border-slate-100">
        <SaltChipSelector
          selectedSaltIds={saltIds}
          onChange={setSaltIds}
          maxSalts={10}
        />
      </div>

      {/* Active Status Toggle (Edit only) */}
      {isEdit && (
        <div className="pt-3 border-t border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <span className="text-xs font-medium text-slate-900 block">
                Active in Wholesale Catalog
              </span>
              <span className="text-[11px] text-slate-400 block">
                Inactive medicines are hidden from retailer catalogs and order creation.
              </span>
            </div>
          </label>
        </div>
      )}

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/medicines')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={!name.trim() || !company.trim()}
        >
          {isEdit ? 'Update Medicine' : 'Create Medicine'}
        </Button>
      </div>
    </form>
  );
}
