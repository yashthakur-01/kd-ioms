'use client';

import React from 'react';
import { Search, X, ArrowUpDown, Filter, ChevronDown, Building2 } from 'lucide-react';

interface CatalogSearchHeaderProps {
  searchInput: string;
  onSearchChange: (val: string) => void;
  searchField?: 'all' | 'name' | 'company' | 'salt';
  onSearchFieldChange?: (val: 'all' | 'name' | 'company' | 'salt') => void;
  company?: string;
  onCompanyChange?: (val: string) => void;
  companies?: string[];
  inStock: boolean;
  onInStockToggle: (val: boolean) => void;
  sort: 'name' | '-name' | 'price' | '-price';
  onSortChange: (val: 'name' | '-name' | 'price' | '-price') => void;
  totalItems?: number;
  onResetFilters: () => void;
}

export function CatalogSearchHeader({
  searchInput,
  onSearchChange,
  searchField = 'all',
  onSearchFieldChange,
  company = '',
  onCompanyChange,
  companies = [],
  inStock,
  onInStockToggle,
  sort,
  onSortChange,
  totalItems,
  onResetFilters,
}: CatalogSearchHeaderProps) {
  const isFiltered = Boolean(
    searchInput || (searchField && searchField !== 'all') || company || !inStock || sort !== 'name'
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs mb-6 space-y-4">
      {/* Top Search Bar with Side Filter Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch bg-white border border-slate-200 rounded-xl shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-600 transition-all overflow-hidden">
        {/* Filter Dropdown on the Side */}
        <div className="relative bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 min-w-[190px] sm:w-60 shrink-0 flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
            <Filter className="w-4 h-4" />
          </div>
          <select
            value={searchField}
            onChange={(e) =>
              onSearchFieldChange?.(e.target.value as 'all' | 'name' | 'company' | 'salt')
            }
            aria-label="Filter search criteria"
            data-testid="catalog-search-field-filter"
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full pl-9 pr-8 py-2.5 bg-transparent text-xs font-semibold text-black !text-black focus:outline-none cursor-pointer appearance-none"
          >
            <option value="all">All (Brand, Company, Salt)</option>
            <option value="name">Brand Name Only</option>
            <option value="company">Company Only</option>
            <option value="salt">Salt Composition Only</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 flex items-center bg-white">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              searchField === 'name'
                ? 'Search by brand name (e.g. Augmentin, Dolo)...'
                : searchField === 'company'
                ? 'Search by company/manufacturer (e.g. GSK, Cipla)...'
                : searchField === 'salt'
                ? 'Search by salt composition (e.g. Paracetamol, Amoxicillin)...'
                : 'Search medicines by brand name, company, or salt composition...'
            }
            style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
            className="w-full pl-10 pr-10 py-2.5 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none text-black !text-black"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* In-Stock Only Toggle Button */}
          <button
            type="button"
            onClick={() => onInStockToggle(!inStock)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              inStock
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                inStock ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span>In-Stock Only</span>
          </button>

          {/* Quick Company Filter Dropdown */}
          {companies && companies.length > 0 && onCompanyChange && (
            <div className="relative inline-flex items-center">
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={company}
                onChange={(e) => onCompanyChange(e.target.value)}
                aria-label="Filter by company"
                data-testid="catalog-company-filter"
                style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
                className="pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-black !text-black focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none max-w-[200px] truncate"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 ml-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Total Count */}
          {totalItems !== undefined && (
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">
              {totalItems} {totalItems === 1 ? 'product' : 'products'} found
            </span>
          )}

          {/* Sort Selector */}
          <div className="relative inline-flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as 'name' | '-name' | 'price' | '-price')}
              style={{ color: '#000000', WebkitTextFillColor: '#000000', colorScheme: 'light' }}
              className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-black !text-black focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
            >
              <option value="name">Name (A → Z)</option>
              <option value="-name">Name (Z → A)</option>
              <option value="price">Price: Low to High</option>
              <option value="-price">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

