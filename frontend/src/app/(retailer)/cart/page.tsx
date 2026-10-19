import React, { Suspense } from 'react';
import { CartCheckoutView } from '@/features/cart/CartCheckoutView';

export const metadata = {
  title: 'Shopping Cart | KD-IOMS',
  description: 'Review items, select quantities, and place your pharmacy order.',
};

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
          Loading cart...
        </div>
      }
    >
      <CartCheckoutView />
    </Suspense>
  );
}
