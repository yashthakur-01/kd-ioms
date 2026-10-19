'use client';

import React, { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '../../../../../components/ui/Spinner';
import { MedicineForm } from '../../../../../features/medicines/components/MedicineForm';
import { useMedicine, useUpdateMedicine } from '../../../../../features/medicines/hooks';
import type { UpdateMedicinePayload } from '../../../../../features/medicines/types';

function EditMedicineContent() {
  const params = useParams();
  const router = useRouter();
  const medicineId = Number(params?.medicineId);

  const { data: medicine, isLoading, isError } = useMedicine(medicineId);
  const updateMutation = useUpdateMedicine();

  const handleUpdate = async (payload: UpdateMedicinePayload) => {
    await updateMutation.mutateAsync({ medicineId, payload });
    router.push('/medicines');
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !medicine) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200 text-xs">
        Failed to load medicine details. Medicine may not exist or network failed.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Edit: {medicine.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Update medicine identity, active ingredients, or GST tax slab rate.
          </p>
        </div>

        {/* Live Stock Aggregates Badge */}
        <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <div>
            <span className="text-[11px] text-emerald-700 block font-medium">Current Stock</span>
            <span className="text-sm font-bold text-emerald-900 font-mono">
              {medicine.onHand ?? 0} units
            </span>
          </div>
          <div className="h-6 w-px bg-emerald-200" />
          <div>
            <span className="text-[11px] text-emerald-700 block font-medium">Active Batches</span>
            <span className="text-sm font-bold text-emerald-900 font-mono">
              {medicine.activeBatchCount ?? 0}
            </span>
          </div>
        </div>
      </div>

      <MedicineForm
        initialData={medicine}
        onSubmit={handleUpdate as (payload: unknown) => Promise<void>}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}

export default function EditMedicinePage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex justify-center items-center">
          <Spinner />
        </div>
      }
    >
      <EditMedicineContent />
    </Suspense>
  );
}
