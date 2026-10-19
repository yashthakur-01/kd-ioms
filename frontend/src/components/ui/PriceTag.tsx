import React from 'react';

export interface PriceTagProps {
  priceInclGst: string | number | null;
  mrp: string | number | null;
  gstRate?: string | number;
  inStock?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceTag({
  priceInclGst,
  mrp,
  gstRate,
  inStock = true,
  size = 'md',
  className = '',
}: PriceTagProps) {
  if (!inStock || priceInclGst === null) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
          Out of Stock
        </span>
      </div>
    );
  }

  const priceNum = typeof priceInclGst === 'number' ? priceInclGst : parseFloat(priceInclGst);
  const mrpNum = mrp != null ? (typeof mrp === 'number' ? mrp : parseFloat(mrp)) : null;

  const formattedPrice = Number.isFinite(priceNum) ? priceNum.toFixed(2) : '0.00';
  const formattedMrp = mrpNum != null && Number.isFinite(mrpNum) ? mrpNum.toFixed(2) : null;

  const savingsPercent =
    mrpNum != null && mrpNum > priceNum && mrpNum > 0
      ? Math.round(((mrpNum - priceNum) / mrpNum) * 100)
      : null;

  const sizeClasses = {
    sm: 'text-sm font-semibold text-slate-900',
    md: 'text-base font-bold text-slate-900',
    lg: 'text-xl font-bold text-slate-900',
  };

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={sizeClasses[size]}>₹{formattedPrice}</span>
        {formattedMrp && mrpNum! > priceNum && (
          <span className="text-xs text-slate-400 line-through">₹{formattedMrp}</span>
        )}
        {savingsPercent != null && savingsPercent > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
            {savingsPercent}% OFF
          </span>
        )}
      </div>
      {gstRate != null && (
        <span className="text-[11px] text-slate-500">
          (Incl. {typeof gstRate === 'number' ? gstRate.toFixed(0) : parseFloat(String(gstRate)).toFixed(0)}% GST)
        </span>
      )}
    </div>
  );
}
