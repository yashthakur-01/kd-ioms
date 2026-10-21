import React, { useState, useRef, useEffect } from 'react';
import { useSearchMedicines } from '../hooks';
import type { MedicineRecord } from '../types';
import { Spinner } from '../../../components/ui/Spinner';

export interface MedicineSearchProps {
  onSelect: (medicine: MedicineRecord) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function MedicineSearch({
  onSelect,
  placeholder = 'Search by medicine brand name or salt formula...',
  autoFocus = false,
  className = '',
}: MedicineSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useSearchMedicines(query);
  const matches: MedicineRecord[] = results || [];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (medicine: MedicineRecord) => {
    onSelect(medicine);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < matches.length) {
        handleSelect(matches[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
          className="w-full pl-9 pr-8 py-2 text-xs bg-white text-black !text-black border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs placeholder:text-slate-400"
        />

        {isLoading ? (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Spinner className="w-4 h-4 text-slate-400" />
          </div>
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs">
          {matches.length > 0 ? (
            matches.map((med, index) => {
              const isSelected = index === activeIndex;
              return (
                <button
                  key={med.medicineId}
                  type="button"
                  onClick={() => handleSelect(med)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer border-b border-slate-50 last:border-b-0 ${
                    isSelected ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">
                      {med.name}
                    </span>
                    {med.packSize && (
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {med.packSize}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-slate-500 text-[11px]">
                    <span className="font-medium text-slate-600">{med.company}</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-700">{med.gstRate}% GST</span>
                  </div>
                  {med.saltsText && (
                    <div className="mt-1 text-[11px] text-slate-500 italic truncate">
                      Salts: {med.saltsText}
                    </div>
                  )}
                </button>
              );
            })
          ) : !isLoading ? (
            <div className="px-4 py-6 text-center text-slate-400 text-xs">
              No matching medicines found for &quot;{query}&quot;.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
