import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MedicinesDirectoryPage from '../../../app/(admin)/medicines/page';
import { MedicineForm } from '../components/MedicineForm';
import { MedicineSearch } from '../components/MedicineSearch';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../providers/ToastProvider';
import * as medicinesApi from '../api';
import * as saltsApi from '../../salts/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/medicines',
  useParams: () => ({ medicineId: '10' }),
}));

describe('Admin Medicines Feature', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders medicine directory table with catalog records and Add Medicine link', async () => {
    vi.spyOn(medicinesApi, 'fetchMedicines').mockResolvedValue({
      success: true,
      code: 'MEDICINES_LISTED',
      message: 'Medicines listed',
      data: [
        {
          medicineId: 10,
          name: 'Augmentin 625 Duo',
          company: 'GSK',
          packSize: '10 Tablets',
          gstRate: '12.00',
          saltIds: [1, 2],
          saltsText: 'Amoxicillin + Potassium Clavulanate',
          salts: [
            { saltId: 1, saltName: 'Amoxicillin' },
            { saltId: 2, saltName: 'Potassium Clavulanate' },
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        requestId: 'req_med_1',
        timestamp: new Date().toISOString(),
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
    });

    vi.spyOn(saltsApi, 'fetchSalts').mockResolvedValue({
      success: true,
      code: 'SALTS_LISTED',
      message: 'Salts listed',
      data: [],
      meta: {
        requestId: 'req_s_1',
        timestamp: new Date().toISOString(),
      },
    });

    renderWithProviders(<MedicinesDirectoryPage />);

    expect(await screen.findByText('Augmentin 625 Duo')).toBeTruthy();
    expect(screen.getByText('GSK')).toBeTruthy();
    expect(screen.getByText('Amoxicillin + Potassium Clavulanate')).toBeTruthy();
    expect(screen.getByRole('link', { name: /\+ Add Medicine/i })).toBeTruthy();
  });

  it('MedicineForm allows toggling GST slabs and editing fields', async () => {
    vi.spyOn(saltsApi, 'fetchSalts').mockResolvedValue({
      success: true,
      code: 'SALTS_LISTED',
      message: 'Salts listed',
      data: [
        {
          saltId: 1,
          saltName: 'Paracetamol',
          isActive: true,
          medicineCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: {
        requestId: 'req_s_2',
        timestamp: new Date().toISOString(),
      },
    });

    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(<MedicineForm onSubmit={handleSubmit} />);

    // Check name and company inputs
    const nameInput = screen.getByPlaceholderText(/e.g. Augmentin 625 Duo/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Dolo 650' } });
    expect(nameInput.value).toBe('Dolo 650');

    const companyInput = screen.getByPlaceholderText(/e.g. GSK, Micro Labs/i) as HTMLInputElement;
    fireEvent.change(companyInput, { target: { value: 'Micro Labs' } });

    // Click 18% GST slab button
    const gst18Btn = screen.getByRole('button', { name: '18%' });
    fireEvent.click(gst18Btn);

    // Custom GST rate input should reflect 18
    const gstInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(gstInput.value).toBe('18');

    // Click predefined salt pill to add it
    const addSaltPill = await screen.findByText('Paracetamol');
    fireEvent.click(addSaltPill);

    // Chip should appear
    expect(await screen.findByText('1 / 10 salts selected')).toBeTruthy();

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /^Create Medicine$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dolo 650',
          company: 'Micro Labs',
          gstRate: 18,
          saltIds: [1],
        })
      );
    });
  });

  it('MedicineSearch debounces query and triggers onSelect on item click', async () => {
    vi.spyOn(medicinesApi, 'searchMedicines').mockResolvedValue([
      {
        medicineId: 10,
        name: 'Augmentin 625 Duo',
        company: 'GSK',
        packSize: '10 Tablets',
        gstRate: '12.00',
        saltIds: [1],
        saltsText: 'Amoxicillin',
        salts: [{ saltId: 1, saltName: 'Amoxicillin' }],
        isActive: true,
        score: 0.9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const handleSelect = vi.fn();

    renderWithProviders(<MedicineSearch onSelect={handleSelect} />);

    const searchInput = screen.getByPlaceholderText(/Search by medicine brand name/i);
    fireEvent.change(searchInput, { target: { value: 'augment' } });

    // Item should appear in dropdown
    const resultItem = await screen.findByRole('button', { name: /Augmentin 625 Duo/i });
    expect(resultItem).toBeTruthy();

    fireEvent.click(resultItem);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        medicineId: 10,
        name: 'Augmentin 625 Duo',
      })
    );
  });
});
