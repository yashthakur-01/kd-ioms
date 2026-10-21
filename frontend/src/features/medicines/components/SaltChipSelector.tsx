import React, { useState } from 'react';
import { useSalts } from '../../salts/hooks';
import { AddSaltModal } from '../../salts/components/AddSaltModal';
import { Button } from '../../../components/ui/Button';
import type { SaltRecord } from '../../salts/types';

interface SaltChipSelectorProps {
  selectedSaltIds: number[];
  onChange: (ids: number[]) => void;
  maxSalts?: number;
}

export function SaltChipSelector({
  selectedSaltIds,
  onChange,
  maxSalts = 10,
}: SaltChipSelectorProps) {
  const [filterText, setFilterText] = useState('');
  const [isAddSaltModalOpen, setIsAddSaltModalOpen] = useState(false);

  // Load all active salts
  const { data: saltsData, isLoading } = useSalts({
    isActive: true,
    pageSize: 100,
    sort: 'saltName:asc',
  });

  const allSalts: SaltRecord[] = saltsData?.data || [];

  // Map of saltId -> SaltRecord for fast lookup
  const saltMap = new Map<number, SaltRecord>();
  allSalts.forEach((s) => saltMap.set(s.saltId, s));

  // Filtered available salts (matching text search and not already selected)
  const availableSalts = allSalts.filter(
    (s) =>
      !selectedSaltIds.includes(s.saltId) &&
      s.saltName.toLowerCase().includes(filterText.toLowerCase().trim())
  );

  const handleAddSaltId = (saltId: number) => {
    if (selectedSaltIds.length >= maxSalts) return;
    if (!selectedSaltIds.includes(saltId)) {
      onChange([...selectedSaltIds, saltId]);
    }
  };

  const handleRemoveSaltId = (saltId: number) => {
    onChange(selectedSaltIds.filter((id) => id !== saltId));
  };

  const handleSaltCreatedOnTheFly = (newSalt: SaltRecord) => {
    if (selectedSaltIds.length < maxSalts && !selectedSaltIds.includes(newSalt.saltId)) {
      onChange([...selectedSaltIds, newSalt.saltId]);
    }
    setIsAddSaltModalOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Header and Salt Counter */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          Associated Salts / Active Ingredients
        </label>
        <span
          className={`text-[11px] font-medium ${
            selectedSaltIds.length >= maxSalts ? 'text-amber-600 font-semibold' : 'text-slate-400'
          }`}
        >
          {selectedSaltIds.length} / {maxSalts} salts selected
        </span>
      </div>

      {/* Selected Chips */}
      {selectedSaltIds.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px] items-center">
          {selectedSaltIds.map((id) => {
            const salt = saltMap.get(id);
            const label = salt ? salt.saltName : `Salt #${id}`;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium shadow-2xs"
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSaltId(id)}
                  className="text-emerald-500 hover:text-emerald-800 transition-colors p-0.5 rounded-full hover:bg-emerald-100"
                  aria-label={`Remove ${label}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
          No salts linked yet. Pick from the catalog below or add a new one on the fly.
        </div>
      )}

      {/* Search and On-The-Fly Add Salt Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            disabled={selectedSaltIds.length >= maxSalts}
            placeholder={
              selectedSaltIds.length >= maxSalts
                ? 'Maximum 10 salts reached'
                : 'Filter catalog salts by name...'
            }
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full px-3 py-1.5 text-xs bg-white text-black !text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 placeholder:text-slate-400"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsAddSaltModalOpen(true)}
          disabled={selectedSaltIds.length >= maxSalts}
          className="whitespace-nowrap"
        >
          + Add New Salt
        </Button>
      </div>

      {/* Predefined Salts Selector Pills */}
      {isLoading ? (
        <p className="text-xs text-slate-400">Loading catalog salts...</p>
      ) : availableSalts.length > 0 ? (
        <div className="max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-white flex flex-wrap gap-1.5">
          {availableSalts.slice(0, 30).map((salt) => (
            <button
              key={salt.saltId}
              type="button"
              onClick={() => handleAddSaltId(salt.saltId)}
              disabled={selectedSaltIds.length >= maxSalts}
              className="inline-flex items-center px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 transition-colors cursor-pointer border border-slate-200/80"
            >
              <span className="mr-1 text-emerald-600 font-bold">+</span>
              {salt.saltName}
            </button>
          ))}
          {availableSalts.length > 30 && (
            <span className="text-[11px] text-slate-400 self-center px-1">
              +{availableSalts.length - 30} more (type to filter)
            </span>
          )}
        </div>
      ) : filterText ? (
        <div className="p-2.5 text-xs text-slate-500 bg-slate-50 rounded-lg flex items-center justify-between">
          <span>No existing salt matched &quot;{filterText}&quot;.</span>
          <button
            type="button"
            onClick={() => setIsAddSaltModalOpen(true)}
            className="text-emerald-700 hover:text-emerald-800 font-semibold underline"
          >
            Create &quot;{filterText}&quot; as new salt?
          </button>
        </div>
      ) : null}

      {/* Inline Add Salt Modal */}
      <AddSaltModal
        isOpen={isAddSaltModalOpen}
        onClose={() => setIsAddSaltModalOpen(false)}
        onCreated={handleSaltCreatedOnTheFly}
      />
    </div>
  );
}
