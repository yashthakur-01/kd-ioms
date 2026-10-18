'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inwardStockFormSchema, type InwardStockFormData } from '../schema';
import { useInwardStock } from '../hooks';
import { MedicineSearch } from '../../medicines/components/MedicineSearch';
import type { MedicineRecord } from '../../medicines/types';
import type { InwardStockResult } from '../types';
import { AlertCircle, CheckCircle2, PackageCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';

export interface ScanConfirmFormProps {
  initialValues?: Partial<InwardStockFormData>;
  onSuccess?: (result: InwardStockResult) => void;
  onReset?: () => void;
}

export function ScanConfirmForm({
  initialValues,
  onSuccess,
  onReset,
}: ScanConfirmFormProps) {
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineRecord | null>(null);
  const [inwardSuccess, setInwardSuccess] = useState<InwardStockResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InwardStockFormData>({
    resolver: zodResolver(inwardStockFormSchema),
    defaultValues: {
      medicineId: initialValues?.medicineId || 0,
      medicineName: initialValues?.medicineName || '',
      medicineCompany: initialValues?.medicineCompany || '',
      gstRate: initialValues?.gstRate || 12,
      batchNumber: initialValues?.batchNumber || '',
      expiryDate: initialValues?.expiryDate || '',
      mrp: initialValues?.mrp || '',
      sellingPrice: initialValues?.sellingPrice || '',
      purchaseRate: initialValues?.purchaseRate || '0.00',
      quantity: initialValues?.quantity || 1,
      supplierName: initialValues?.supplierName || '',
      gtin: initialValues?.gtin || '',
      qrPayload: initialValues?.qrPayload || '',
      captureMethod: initialValues?.captureMethod || 'MANUAL',
    },
  });

  const inwardMutation = useInwardStock();

  // Keep form updated when initialValues change from external scan
  useEffect(() => {
    if (initialValues) {
      if (initialValues.medicineId) {
        setValue('medicineId', initialValues.medicineId);
      }
      if (initialValues.medicineName) {
        setValue('medicineName', initialValues.medicineName);
      }
      if (initialValues.medicineCompany) {
        setValue('medicineCompany', initialValues.medicineCompany);
      }
      if (initialValues.gstRate !== undefined) {
        setValue('gstRate', initialValues.gstRate);
      }
      if (initialValues.batchNumber) {
        setValue('batchNumber', initialValues.batchNumber);
      }
      if (initialValues.expiryDate) {
        setValue('expiryDate', initialValues.expiryDate);
      }
      if (initialValues.mrp) {
        setValue('mrp', initialValues.mrp);
      }
      if (initialValues.sellingPrice) {
        setValue('sellingPrice', initialValues.sellingPrice);
      }
      if (initialValues.purchaseRate) {
        setValue('purchaseRate', initialValues.purchaseRate);
      }
      if (initialValues.quantity) {
        setValue('quantity', initialValues.quantity);
      }
      if (initialValues.supplierName) {
        setValue('supplierName', initialValues.supplierName);
      }
      if (initialValues.gtin) {
        setValue('gtin', initialValues.gtin);
      }
      if (initialValues.qrPayload) {
        setValue('qrPayload', initialValues.qrPayload);
      }
      if (initialValues.captureMethod) {
        setValue('captureMethod', initialValues.captureMethod);
      }
    }
  }, [initialValues, setValue]);

  const watchedSellingPrice = watch('sellingPrice');
  const watchedMrp = watch('mrp');
  const watchedGstRate = watch('gstRate') ?? 12;
  const watchedCaptureMethod = watch('captureMethod');

  // Compute live price inclusive of GST
  const parsedSp = parseFloat(watchedSellingPrice || '0');
  const parsedMrp = parseFloat(watchedMrp || '0');
  const priceInclGst = (parsedSp * (1 + watchedGstRate / 100)).toFixed(2);
  const exceedsMrp = parsedMrp > 0 && parseFloat(priceInclGst) > parsedMrp;

  const handleMedicineSelect = (medicine: MedicineRecord) => {
    setSelectedMedicine(medicine);
    setValue('medicineId', medicine.medicineId, { shouldValidate: true });
    setValue('medicineName', medicine.name);
    setValue('medicineCompany', medicine.company);
    setValue('gstRate', parseFloat(medicine.gstRate) || 12);
  };

  const onSubmit = async (data: InwardStockFormData) => {
    setFormError(null);
    try {
      const response = await inwardMutation.mutateAsync({
        medicineId: data.medicineId,
        batchNumber: data.batchNumber.trim(),
        expiryDate: data.expiryDate,
        mrp: parseFloat(data.mrp).toFixed(2),
        sellingPrice: parseFloat(data.sellingPrice).toFixed(2),
        purchaseRate: data.purchaseRate ? parseFloat(data.purchaseRate).toFixed(2) : '0.00',
        quantity: data.quantity,
        supplierName: data.supplierName?.trim() || undefined,
        gtin: data.gtin?.trim() || undefined,
        qrPayload: data.qrPayload || undefined,
        captureMethod: data.captureMethod,
      });

      setInwardSuccess(response.data);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record stock inward');
    }
  };

  const handleReceiveAnother = () => {
    setInwardSuccess(null);
    setSelectedMedicine(null);
    setFormError(null);
    reset({
      medicineId: 0,
      medicineName: '',
      medicineCompany: '',
      gstRate: 12,
      batchNumber: '',
      expiryDate: '',
      mrp: '',
      sellingPrice: '',
      purchaseRate: '0.00',
      quantity: 1,
      supplierName: '',
      gtin: '',
      qrPayload: '',
      captureMethod: 'MANUAL',
    });
    if (onReset) onReset();
  };

  if (inwardSuccess) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm text-center max-w-xl mx-auto">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">
          Stock Inward Successfully Recorded!
        </h3>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-semibold">
          <PackageCheck className="w-4 h-4" />
          {inwardSuccess.action === 'CREATED' ? 'New Batch Created' : 'Existing Batch Topped Up'}
        </div>

        <div className="mt-6 bg-slate-50 rounded-xl p-4 text-left border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Batch Number:</span>
            <span className="font-mono font-semibold text-slate-900">{inwardSuccess.batch.batchNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Expiry Date:</span>
            <span className="text-slate-900">{inwardSuccess.batch.expiryDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Updated Stock Balance:</span>
            <span className="font-semibold text-emerald-700">{inwardSuccess.ledgerEntry.balanceAfter} units</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ledger Entry ID:</span>
            <span className="font-mono text-slate-700">#{inwardSuccess.ledgerEntry.entryId}</span>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={handleReceiveAnother}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Receive Another Batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Capture Mode Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Capture Mode
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
            watchedCaptureMethod === 'SCAN_BARCODE'
              ? 'bg-purple-100 text-purple-800'
              : watchedCaptureMethod === 'SCAN_OCR'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {watchedCaptureMethod}
        </span>
      </div>

      {/* 1. Medicine Selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Medicine <span className="text-red-500">*</span>
        </label>
        {selectedMedicine || watch('medicineName') ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedMedicine?.name || watch('medicineName')}
              </p>
              <p className="text-xs text-slate-500">
                {selectedMedicine?.company || watch('medicineCompany')} • GST: {watchedGstRate}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedMedicine(null);
                setValue('medicineId', 0);
                setValue('medicineName', '');
              }}
              className="text-xs text-indigo-600 hover:underline font-semibold"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <MedicineSearch onSelect={handleMedicineSelect} placeholder="Search medicine to link..." />
            {errors.medicineId && (
              <p className="text-xs text-red-600 mt-1">{errors.medicineId.message}</p>
            )}
          </div>
        )}
      </div>

      {/* 2. Batch Number & Expiry Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Batch Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('batchNumber')}
            placeholder="e.g. B-99420"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          {errors.batchNumber && (
            <p className="text-xs text-red-600 mt-1">{errors.batchNumber.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expiry Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            min={today}
            {...register('expiryDate')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.expiryDate && (
            <p className="text-xs text-red-600 mt-1">{errors.expiryDate.message}</p>
          )}
        </div>
      </div>

      {/* 3. Pricing: MRP, Selling Price, Price Incl. GST calculation */}
      <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              MRP (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('mrp')}
              placeholder="e.g. 150.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {errors.mrp && <p className="text-xs text-red-600 mt-1">{errors.mrp.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Selling Price before GST (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('sellingPrice')}
              placeholder="e.g. 120.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {errors.sellingPrice && (
              <p className="text-xs text-red-600 mt-1">{errors.sellingPrice.message}</p>
            )}
          </div>
        </div>

        {/* GST Preview & Ceiling Warning */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 border-t border-slate-200">
          <span className="text-slate-600">
            Calculated Price (incl. {watchedGstRate}% GST):{' '}
            <strong className="text-slate-900 font-mono">₹{priceInclGst}</strong>
          </span>
          {exceedsMrp && (
            <span className="text-red-600 font-semibold flex items-center gap-1 mt-1 sm:mt-0">
              <AlertTriangle className="w-3.5 h-3.5" /> Exceeds MRP ceiling of ₹{parsedMrp.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* 4. Quantity, Purchase Rate & Supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Quantity Received <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register('quantity', { valueAsNumber: true })}
            placeholder="e.g. 50"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          {errors.quantity && (
            <p className="text-xs text-red-600 mt-1">{errors.quantity.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Purchase Rate (₹)
          </label>
          <input
            type="text"
            {...register('purchaseRate')}
            placeholder="0.00"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Supplier Name
          </label>
          <input
            type="text"
            {...register('supplierName')}
            placeholder="e.g. Apex Pharma Dist."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 5. GTIN (optional barcode identifier) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          GTIN / Barcode (optional)
        </label>
        <input
          type="text"
          {...register('gtin')}
          placeholder="e.g. 08901234567890"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
        />
        {errors.gtin && <p className="text-xs text-red-600 mt-1">{errors.gtin.message}</p>}
      </div>

      {/* Submit Button */}
      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={inwardMutation.isPending || exceedsMrp}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
        >
          {inwardMutation.isPending ? (
            <>
              <Spinner size="sm" />
              Recording Inward...
            </>
          ) : (
            'Confirm & Inward Stock'
          )}
        </button>
      </div>
    </form>
  );
}
