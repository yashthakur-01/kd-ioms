'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../../cart/useCart';
import { useAuth } from '../../../providers/AuthProvider';

export function FloatingCartBar() {
  const { totalQuantity, subtotal } = useCart();
  const { user } = useAuth();
  const cartHref = user?.role === 'DELIVERY' ? '/delivery/orders/new' : '/cart';

  if (totalQuantity === 0) {
    return null;
  }

  return (
    <aside 
      aria-label="Cart Summary"
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-40 transition-all duration-300 transform translate-y-0"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 sm:px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base text-white">
                {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
              </span>
              <span className="text-slate-500 hidden sm:inline">•</span>
              <span className="text-emerald-400 font-bold text-sm sm:text-base">
                ₹{subtotal}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Estimated total incl. GST
            </p>
          </div>
        </div>

        <Link
          href={cartHref}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-900/30"
        >
          <span>View Cart</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </aside>
  );
}
