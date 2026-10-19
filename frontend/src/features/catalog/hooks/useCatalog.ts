'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalog, fetchCatalogItem, type CatalogQueryParams } from '../catalog.api';

export const catalogKeys = {
  all: ['catalog'] as const,
  lists: () => [...catalogKeys.all, 'list'] as const,
  list: (params: CatalogQueryParams) => [...catalogKeys.lists(), params] as const,
  details: () => [...catalogKeys.all, 'detail'] as const,
  detail: (id: number) => [...catalogKeys.details(), id] as const,
};

export function useCatalogQuery(params: CatalogQueryParams = {}) {
  return useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: () => fetchCatalog(params),
  });
}

export function useCatalogItemQuery(medicineId: number) {
  return useQuery({
    queryKey: catalogKeys.detail(medicineId),
    queryFn: () => fetchCatalogItem(medicineId),
    enabled: Boolean(medicineId),
  });
}

export function useCatalog(initialParams: Partial<CatalogQueryParams> = {}) {
  const [searchInput, setSearchInput] = useState(initialParams.q || '');
  const [debouncedQ, setDebouncedQ] = useState(initialParams.q || '');
  const [inStock, setInStock] = useState<boolean>(initialParams.inStock !== undefined ? initialParams.inStock : true);
  const [saltId, setSaltId] = useState<number | undefined>(initialParams.saltId);
  const [sort, setSort] = useState<'name' | '-name' | 'price' | '-price'>(initialParams.sort || 'name');
  const [page, setPage] = useState<number>(initialParams.page || 1);
  const pageSize = initialParams.pageSize || 20;

  // 300ms debounce for search query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1); // Reset to page 1 on new query
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams: CatalogQueryParams = useMemo(() => {
    return {
      q: debouncedQ || undefined,
      inStock,
      saltId,
      sort,
      page,
      pageSize,
    };
  }, [debouncedQ, inStock, saltId, sort, page, pageSize]);

  const queryResult = useCatalogQuery(queryParams);

  const handleInStockToggle = useCallback((val: boolean) => {
    setInStock(val);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSort: 'name' | '-name' | 'price' | '-price') => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handleSaltSelect = useCallback((id?: number) => {
    setSaltId(id);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedQ('');
    setInStock(true);
    setSaltId(undefined);
    setSort('name');
    setPage(1);
  }, []);

  return {
    searchInput,
    setSearchInput,
    debouncedQ,
    inStock,
    setInStock: handleInStockToggle,
    saltId,
    setSaltId: handleSaltSelect,
    sort,
    setSort: handleSortChange,
    page,
    setPage,
    pageSize,
    resetFilters,
    medicines: queryResult.data?.data || [],
    pagination: queryResult.data?.meta?.pagination,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
}
