'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { OrderPickView } from '@/features/orders/OrderPickView';
import { Loader2 } from 'lucide-react';

function OrderPickPageContent() {
  const params = useParams();
  const orderId = Number(params?.orderId);

  if (isNaN(orderId) || orderId <= 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        Invalid order ID provided for picking.
      </div>
    );
  }

  return <OrderPickView orderId={orderId} />;
}

export default function AdminOrderPickPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Loading picking interface...</p>
        </div>
      }
    >
      <OrderPickPageContent />
    </Suspense>
  );
}
