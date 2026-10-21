import type { Request, Response } from 'express';
import * as catalogService from './catalog.service.js';
import { ok, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function getCatalog(req: Request, res: Response) {
  const query = (req as unknown as { valid: { query: catalogService.ListCatalogQuery } }).valid.query;
  const { rows, totalItems } = await catalogService.getCatalog(query);

  return okList(res, {
    code: SUCCESS_CODES.CATALOG_LISTED,
    message: 'Catalog retrieved successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function getCatalogItem(req: Request, res: Response) {
  const { medicineId } = (req as unknown as { valid: { params: { medicineId: number } } }).valid.params;
  const item = await catalogService.getCatalogItem(medicineId);

  return ok(res, {
    code: SUCCESS_CODES.CATALOG_ITEM_FETCHED,
    message: 'Catalog item retrieved successfully',
    data: item,
  });
}

export async function getOutOfStockAlerts(req: Request, res: Response) {
  const query = (req as unknown as { valid: { query: { page?: number; pageSize?: number } } }).valid.query;
  const { rows, totalItems } = await catalogService.getOutOfStockAlerts(query);

  return okList(res, {
    code: SUCCESS_CODES.ALERTS_LISTED,
    message: 'Out of stock alerts retrieved successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function getCatalogCompanies(req: Request, res: Response) {
  const companies = await catalogService.getCatalogCompanies();

  return ok(res, {
    code: SUCCESS_CODES.CATALOG_LISTED,
    message: 'Catalog companies retrieved successfully',
    data: companies,
  });
}

