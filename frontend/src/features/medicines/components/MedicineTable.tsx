import React from 'react';
import Link from 'next/link';
import type { MedicineRecord } from '../types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface MedicineTableProps {
  medicines: MedicineRecord[];
}

export function MedicineTable({ medicines }: MedicineTableProps) {
  if (medicines.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        <p className="text-sm font-medium">No medicines found in catalog.</p>
        <p className="text-xs text-slate-400 mt-1">
          Try clearing your search query or filters, or add a new medicine.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
            <th className="px-5 py-3.5">Medicine Name</th>
            <th className="px-5 py-3.5">Manufacturer</th>
            <th className="px-5 py-3.5">Active Salts Composition</th>
            <th className="px-5 py-3.5">GST Rate</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {medicines.map((med) => (
            <tr key={med.medicineId} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-5 py-3.5">
                <div className="font-semibold text-slate-900 text-sm">{med.name}</div>
                {med.packSize && (
                  <span className="text-[11px] text-slate-500 inline-block font-mono bg-slate-100 px-1.5 py-0.5 rounded mt-0.5">
                    {med.packSize}
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 font-medium text-slate-700">
                {med.company}
              </td>
              <td className="px-5 py-3.5 max-w-xs">
                {med.saltsText ? (
                  <div className="text-slate-800 line-clamp-2" title={med.saltsText}>
                    {med.saltsText}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No salts specified</span>
                )}
              </td>
              <td className="px-5 py-3.5 font-mono font-medium text-slate-800">
                {med.gstRate}%
              </td>
              <td className="px-5 py-3.5">
                <Badge variant={med.isActive ? 'success' : 'neutral'}>
                  {med.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link href={`/medicines/${med.medicineId}/edit`}>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
