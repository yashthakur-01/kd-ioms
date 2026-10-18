import React from 'react';
import type { SaltRecord } from '../types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface SaltTableProps {
  salts: SaltRecord[];
  onEdit: (salt: SaltRecord) => void;
}

export function SaltTable({ salts, onEdit }: SaltTableProps) {
  if (salts.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        <p className="text-sm font-medium">No salts found.</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or add a new salt.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
            <th className="px-5 py-3.5">Salt Name</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Linked Medicines</th>
            <th className="px-5 py-3.5">Created Date</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {salts.map((salt) => (
            <tr key={salt.saltId} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-5 py-3.5 font-medium text-slate-900">
                {salt.saltName}
              </td>
              <td className="px-5 py-3.5">
                <Badge variant={salt.isActive ? 'success' : 'neutral'}>
                  {salt.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                  {salt.medicineCount} {salt.medicineCount === 1 ? 'medicine' : 'medicines'}
                </span>
              </td>
              <td className="px-5 py-3.5 text-slate-500">
                {new Date(salt.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(salt)}
                >
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
