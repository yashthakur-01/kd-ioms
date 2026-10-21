'use client';

import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCatalog } from '@/features/catalog/hooks/useCatalog';
import { CatalogSearchHeader } from '@/features/catalog/components/CatalogSearchHeader';
import { MedicineCatalogGrid } from '@/features/catalog/components/MedicineCatalogGrid';
import { FloatingCartBar } from '@/features/catalog/components/FloatingCartBar';
import { Pagination } from '@/components/ui/Pagination';

export default function RetailerCatalogPage() {
  const {
    searchInput,
    setSearchInput,
    searchField,
    setSearchField,
    company,
    setCompany,
    companies,
    inStock,
    setInStock,
    sort,
    setSort,
    page,
    setPage,
    pageSize,
    resetFilters,
    medicines,
    pagination,
    isLoading,
  } = useCatalog();

  const totalItems = pagination?.totalItems ?? (medicines.length > 0 ? medicines.length : 0);

  return (
    <div className="pb-16 sm:pb-24">
      <PageHeader
        title="Medicine Catalog"
        description="Browse available medicines, price ceilings, and live warehouse inventory"
      />

      {/* Filter and Search Controls */}
      <CatalogSearchHeader
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        company={company}
        onCompanyChange={setCompany}
        companies={companies}
        inStock={inStock}
        onInStockToggle={setInStock}
        sort={sort}
        onSortChange={setSort}
        totalItems={totalItems}
        onResetFilters={resetFilters}
      />

      {/* Medicine Grid */}
      <MedicineCatalogGrid
        medicines={medicines}
        isLoading={isLoading}
        onResetFilters={resetFilters}
      />

      {/* Pagination */}
      {!isLoading && totalItems > pageSize && (
        <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Sticky Bottom Cart Bar */}
      <FloatingCartBar />
    </div>
  );
}
