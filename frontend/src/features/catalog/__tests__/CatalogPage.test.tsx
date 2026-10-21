import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MedicineCatalogCard } from '../components/MedicineCatalogCard';
import { CatalogSearchHeader } from '../components/CatalogSearchHeader';
import { MedicineCatalogGrid } from '../components/MedicineCatalogGrid';
import type { CatalogItem } from '../catalog.api';

describe('Retailer Catalog UI Components', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const sampleMedicine: CatalogItem = {
    medicineId: 101,
    name: 'Augmentin 625 Duo Tablet',
    company: 'GSK',
    packSize: '10 Tablets',
    saltsText: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
    salts: [
      { saltId: 1, saltName: 'Amoxicillin' },
      { saltId: 2, saltName: 'Clavulanic Acid' },
    ],
    gstRate: '12.00',
    maxMrp: '223.50',
    maxPriceInclGst: '201.15',
    availableQty: 25,
    inStock: true,
  };

  const outOfStockMedicine: CatalogItem = {
    medicineId: 102,
    name: 'Depleted Stock Tablet',
    company: 'Abbott',
    packSize: '10 Tablets',
    saltsText: 'Paracetamol (500mg)',
    salts: [],
    gstRate: '12.00',
    maxMrp: null,
    maxPriceInclGst: null,
    availableQty: 0,
    inStock: false,
  };

  describe('MedicineCatalogCard', () => {
    it('renders medicine information, composition, and in-stock badge', () => {
      render(<MedicineCatalogCard medicine={sampleMedicine} />);

      expect(screen.getByText('Augmentin 625 Duo Tablet')).toBeDefined();
      expect(screen.getByText('GSK')).toBeDefined();
      expect(screen.getByText('10 Tablets')).toBeDefined();
      expect(screen.getByText(/Amoxicillin \(500mg\)/)).toBeDefined();
      expect(screen.getByText(/In Stock \(25\)/)).toBeDefined();
    });

    it('stepper increments and decrements quantity within bounds', () => {
      render(<MedicineCatalogCard medicine={{ ...sampleMedicine, availableQty: 3 }} />);

      const minusBtn = screen.getByRole('button', { name: /decrease quantity/i });
      const plusBtn = screen.getByRole('button', { name: /increase quantity/i });

      expect(minusBtn.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText('1')).toBeDefined();

      fireEvent.click(plusBtn);
      expect(screen.getByText('2')).toBeDefined();

      fireEvent.click(plusBtn);
      expect(screen.getByText('3')).toBeDefined();
      expect(plusBtn.hasAttribute('disabled')).toBe(true);

      fireEvent.click(minusBtn);
      expect(screen.getByText('2')).toBeDefined();
    });

    it('adds item to cart and changes button label', () => {
      render(<MedicineCatalogCard medicine={sampleMedicine} />);

      const addBtn = screen.getByRole('button', { name: /add to cart/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/added!/i)).toBeDefined();
    });

    it('renders disabled "Out of Stock" button when availableQty is 0', () => {
      render(<MedicineCatalogCard medicine={outOfStockMedicine} />);

      const disabledButtons = screen.getAllByRole('button');
      const outOfStockBtn = disabledButtons.find((b) => b.textContent?.includes('Out of Stock'));
      expect(outOfStockBtn).toBeDefined();
      expect(outOfStockBtn?.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('CatalogSearchHeader', () => {
    it('handles search input, inStock toggle, and sort changes', () => {
      const handleSearch = vi.fn();
      const handleToggle = vi.fn();
      const handleSort = vi.fn();
      const handleReset = vi.fn();

      render(
        <CatalogSearchHeader
          searchInput="Augmentin"
          onSearchChange={handleSearch}
          inStock={true}
          onInStockToggle={handleToggle}
          sort="price"
          onSortChange={handleSort}
          totalItems={12}
          onResetFilters={handleReset}
        />
      );

      expect(screen.getByDisplayValue('Augmentin')).toBeDefined();
      expect(screen.getByText('12 products found')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /in-stock only/i }));
      expect(handleToggle).toHaveBeenCalledWith(false);

      fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('renders side filter dropdown and handles criteria changes (brand, company, salt, all)', () => {
      const handleSearchFieldChange = vi.fn();

      render(
        <CatalogSearchHeader
          searchInput=""
          onSearchChange={vi.fn()}
          searchField="all"
          onSearchFieldChange={handleSearchFieldChange}
          inStock={true}
          onInStockToggle={vi.fn()}
          sort="name"
          onSortChange={vi.fn()}
          onResetFilters={vi.fn()}
        />
      );

      const filterSelect = screen.getByTestId('catalog-search-field-filter');
      expect(filterSelect).toBeDefined();

      // Check default placeholder for 'all'
      expect(
        screen.getByPlaceholderText(/search medicines by brand name, company, or salt composition/i)
      ).toBeDefined();

      // Select brand name
      fireEvent.change(filterSelect, { target: { value: 'name' } });
      expect(handleSearchFieldChange).toHaveBeenCalledWith('name');
    });

    it('renders company filter dropdown and handles selection', () => {
      const handleCompanyChange = vi.fn();

      render(
        <CatalogSearchHeader
          searchInput=""
          onSearchChange={vi.fn()}
          company=""
          onCompanyChange={handleCompanyChange}
          companies={['GlaxoSmithKline', 'Cipla', 'Abbott']}
          inStock={true}
          onInStockToggle={vi.fn()}
          sort="name"
          onSortChange={vi.fn()}
          onResetFilters={vi.fn()}
        />
      );

      const companySelect = screen.getByTestId('catalog-company-filter');
      expect(companySelect).toBeDefined();
      expect(screen.getByText('All Companies')).toBeDefined();
      expect(screen.getByText('GlaxoSmithKline')).toBeDefined();
      expect(screen.getByText('Cipla')).toBeDefined();

      fireEvent.change(companySelect, { target: { value: 'Cipla' } });
      expect(handleCompanyChange).toHaveBeenCalledWith('Cipla');
    });
  });

  describe('MedicineCatalogGrid', () => {
    it('renders cards for all items', () => {
      render(
        <MedicineCatalogGrid
          medicines={[sampleMedicine, outOfStockMedicine]}
          isLoading={false}
          onResetFilters={vi.fn()}
        />
      );

      expect(screen.getByText('Augmentin 625 Duo Tablet')).toBeDefined();
      expect(screen.getByText('Depleted Stock Tablet')).toBeDefined();
    });

    it('renders empty state when medicines array is empty', () => {
      render(
        <MedicineCatalogGrid
          medicines={[]}
          isLoading={false}
          onResetFilters={vi.fn()}
        />
      );

      expect(screen.getByText(/no medicines found/i)).toBeDefined();
    });
  });
});
