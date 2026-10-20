'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DoorstepChecklistView } from '@/features/delivery/DoorstepChecklistView';
import { Spinner } from '@/components/ui/Spinner';

function DoorstepOrderContent() {
  const params = useParams();
  const orderId = Number(params?.orderId);

  if (isNaN(orderId) || orderId <= 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        Invalid order ID provided.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <DoorstepChecklistView orderId={orderId} />
    </div>
  );
}

export default function DoorstepOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" />
          <p className="mt-3 text-xs font-semibold">Loading delivery details...</p>
        </div>
      }
    >
      <DoorstepOrderContent />
    </Suspense>
  );
}
