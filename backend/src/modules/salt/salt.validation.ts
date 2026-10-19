import { z } from 'zod';
import { idParam, paginationQuery } from '../../utils/validators.js';

export const listSaltsSchema = {
  query: paginationQuery
    .extend({
      q: z.string().trim().max(100).optional(),
      isActive: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      sort: z.string().optional(),
    })
    .strict(),
};

export const suggestSaltsSchema = {
  query: z
    .object({
      q: z
        .string()
        .trim()
        .min(2, 'Search query must be at least 2 characters')
        .max(80, 'Search query cannot exceed 80 characters'),
    })
    .strict(),
};

export const createSaltSchema = {
  body: z
    .object({
      saltName: z
        .string()
        .trim()
        .min(2, 'Salt name must be at least 2 characters')
        .max(120, 'Salt name cannot exceed 120 characters')
        .regex(/^[A-Za-z0-9\s\-(),.]+$/, 'Salt name contains invalid characters'),
      confirmSimilar: z.boolean().default(false),
    })
    .strict(),
};

export const updateSaltSchema = {
  params: z
    .object({
      saltId: idParam,
    })
    .strict(),
  body: z
    .object({
      saltName: z
        .string()
        .trim()
        .min(2, 'Salt name must be at least 2 characters')
        .max(120, 'Salt name cannot exceed 120 characters')
        .regex(/^[A-Za-z0-9\s\-(),.]+$/, 'Salt name contains invalid characters')
        .optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => data.saltName !== undefined || data.isActive !== undefined, {
      message: 'At least one field (saltName or isActive) must be provided for update',
    }),
};
