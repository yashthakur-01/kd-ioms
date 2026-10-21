import { apiFetch, type ApiResponse } from '../../lib/api/client';

export interface CatalogSalt {
  saltId: number;
  saltName: string;
}

export interface CatalogItem {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  saltsText: string;
  salts: CatalogSalt[];
  gstRate: string;
  maxMrp: string | null;
  maxPriceInclGst: string | null;
  availableQty: number;
  inStock: boolean;
}

export interface CatalogQueryParams {
  q?: string;
  searchField?: 'all' | 'name' | 'company' | 'salt';
  company?: string;
  saltId?: number;
  inStock?: boolean;
  sort?: 'name' | '-name' | 'price' | '-price';
  page?: number;
  pageSize?: number;
}

export async function fetchCatalog(params: CatalogQueryParams = {}): Promise<ApiResponse<CatalogItem[]>> {
  return apiFetch<CatalogItem[]>('/catalog', {
    query: {
      q: params.q || undefined,
      searchField: params.searchField && params.searchField !== 'all' ? params.searchField : undefined,
      company: params.company || undefined,
      saltId: params.saltId || undefined,
      inStock: params.inStock != null ? String(params.inStock) : undefined,
      sort: params.sort || undefined,
      page: params.page || undefined,
      pageSize: params.pageSize || undefined,
    },
  });
}

export async function fetchCatalogItem(medicineId: number): Promise<ApiResponse<CatalogItem>> {
  return apiFetch<CatalogItem>(`/catalog/${medicineId}`);
}

export async function fetchCatalogCompanies(): Promise<ApiResponse<string[]>> {
  return apiFetch<string[]>('/catalog/companies');
}

