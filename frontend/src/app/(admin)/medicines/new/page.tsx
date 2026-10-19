'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MedicineForm } from '../../../../features/medicines/components/MedicineForm';
import { useCreateMedicine } from '../../../../features/medicines/hooks';
import type { CreateMedicinePayload } from '../../../../features/medicines/types';

export default function NewMedicinePage() {
  const router = useRouter();
  const createMutation = useCreateMedicine();

  const handleCreate = async (payload: CreateMedicinePayload) => {
    await createMutation.mutateAsync(payload);
    router.push('/medicines');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Add New Medicine</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Create a new pharmaceutical product record with packaging details, tax slabs, and active salts.
        </p>
      </div>

      <MedicineForm
        onSubmit={handleCreate as (payload: unknown) => Promise<void>}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
