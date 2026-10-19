'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { OrderDetailView } from '@/features/orders/OrderDetailView';

function OrderDetailContent() {
  const params = useParams();
  const orderId = Number(params?.orderId);

  if (isNaN(orderId) || orderId <= 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        Invalid order ID provided.
      </div>
    );
  }

  return <OrderDetailView orderId={orderId} />;
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
          Loading order details...
        </div>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
