import { z } from 'zod';
import { paginationQuery, idParam } from '../../utils/validators.js';

export const listCatalogSchema = {
  query: paginationQuery
    .extend({
      q: z.string().trim().max(100).optional(),
      searchField: z.enum(['all', 'name', 'company', 'salt']).default('all').optional(),
      company: z.string().trim().max(100).optional(),
      saltId: z.coerce.number().int().positive().optional(),
      inStock: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      sort: z.enum(['name', '-name', 'price', '-price']).default('name').optional(),
    })
    .strict(),
};

export const getCatalogItemSchema = {
  params: z
    .object({
      medicineId: idParam,
    })
    .strict(),
};

export const outOfStockAlertsSchema = {
  query: paginationQuery.strict(),
};
