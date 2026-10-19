'use client';

import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import type { CatalogItem } from '../catalog.api';
import { PriceTag } from '../../../components/ui/PriceTag';
import { useCart } from '../../cart/useCart';

interface MedicineCatalogCardProps {
  medicine: CatalogItem;
}

export function MedicineCatalogCard({ medicine }: MedicineCatalogCardProps) {
  const { addItem, getItemQuantity } = useCart();
  const inCartQty = getItemQuantity(medicine.medicineId);
  const [stepperQty, setStepperQty] = useState<number>(1);
  const [justAdded, setJustAdded] = useState(false);

  const isSellable = medicine.inStock && medicine.availableQty > 0;

  const handleAddToCart = () => {
    if (!isSellable || !medicine.maxPriceInclGst) return;

    addItem(
      {
        medicineId: medicine.medicineId,
        name: medicine.name,
        company: medicine.company,
        packSize: medicine.packSize,
        priceInclGst: medicine.maxPriceInclGst,
        mrp: medicine.maxMrp || medicine.maxPriceInclGst,
        gstRate: medicine.gstRate,
        maxAvailable: medicine.availableQty,
      },
      stepperQty
    );

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const incrementStepper = () => {
    setStepperQty((prev) => Math.min(medicine.availableQty, prev + 1));
  };

  const decrementStepper = () => {
    setStepperQty((prev) => Math.max(1, prev - 1));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Header: Name, Company, Pack Size */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors">
              {medicine.name}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{medicine.company}</p>
          </div>
          {medicine.packSize && (
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
              {medicine.packSize}
            </span>
          )}
        </div>

        {/* Salts Composition */}
        {medicine.saltsText && (
          <div className="mb-4">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-relaxed">
              <span className="font-medium text-slate-700">Composition: </span>
              {medicine.saltsText}
            </p>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-3">
        {/* Price Tag & Live Availability */}
        <div className="flex items-end justify-between gap-2">
          <PriceTag
            priceInclGst={medicine.maxPriceInclGst}
            mrp={medicine.maxMrp}
            gstRate={medicine.gstRate}
            inStock={medicine.inStock}
            size="md"
          />

          <div className="text-right">
            {medicine.availableQty > 10 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                In Stock ({medicine.availableQty})
              </span>
            ) : medicine.availableQty > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Only {medicine.availableQty} left
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                0 Available
              </span>
            )}
          </div>
        </div>

        {/* Action Controls & Quantity Stepper */}
        {isSellable ? (
          <div className="flex items-center gap-2 pt-1">
            {/* Interactive Quantity Stepper */}
            <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={decrementStepper}
                disabled={stepperQty <= 1}
                className="w-8 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center font-bold text-xs text-slate-800">
                {stepperQty}
              </span>
              <button
                type="button"
                onClick={incrementStepper}
                disabled={stepperQty >= medicine.availableQty}
                className="w-8 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add to Cart CTA */}
            <button
              type="button"
              onClick={handleAddToCart}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl font-semibold text-xs transition-all shadow-xs active:scale-98 ${
                justAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added!</span>
                </>
              ) : inCartQty > 0 ? (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add More ({inCartQty} in cart)</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              disabled
              className="w-full h-9 rounded-xl font-semibold text-xs bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              Out of Stock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
