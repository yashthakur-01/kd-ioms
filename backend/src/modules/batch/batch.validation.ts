import { z } from 'zod';
import { BATCH_STATUS_VALUES } from '../../enums/batch-status.enum.js';
import { LEDGER_ENTRY_TYPE_VALUES } from '../../enums/ledger-entry-type.enum.js';

export const listBatchesSchema = {
  query: z
    .object({
      medicineId: z.coerce.number().int().positive().optional(),
      status: z.enum(BATCH_STATUS_VALUES).optional(),
      expiry: z.enum(['ALL', 'NEAR', 'EXPIRED']).optional().default('ALL'),
      inStock: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      q: z.string().trim().max(100).optional(),
      sort: z
        .enum([
          'expiryDate',
          '-expiryDate',
          'createdAt',
          '-createdAt',
          'batchNumber',
          '-batchNumber',
        ])
        .optional()
        .default('expiryDate'),
      page: z.coerce.number().int().positive().optional().default(1),
      pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
    })
    .strict(),
};

export const getBatchSchema = {
  params: z
    .object({
      batchId: z.coerce.number().int().positive(),
    })
    .strict(),
};

export const updateBatchSchema = {
  params: z
    .object({
      batchId: z.coerce.number().int().positive(),
    })
    .strict(),
  body: z
    .object({
      sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      status: z.enum(BATCH_STATUS_VALUES).optional(),
    })
    .strict()
    .refine((data) => data.sellingPrice !== undefined || data.status !== undefined, {
      message: 'At least one field (sellingPrice or status) must be provided',
    }),
};

export const adjustBatchSchema = {
  params: z
    .object({
      batchId: z.coerce.number().int().positive(),
    })
    .strict(),
  body: z
    .object({
      type: z.enum(['DAMAGE', 'CORRECTION', 'EXPIRY_WRITEOFF'], {
        message: 'Adjustment type must be DAMAGE, CORRECTION, or EXPIRY_WRITEOFF',
      }),
      quantity: z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero'),
      reason: z
        .string()
        .trim()
        .min(5, 'Reason must be at least 5 characters')
        .max(300, 'Reason cannot exceed 300 characters'),
    })
    .strict(),
};

export const listLedgerSchema = {
  query: z
    .object({
      batchId: z.coerce.number().int().positive().optional(),
      medicineId: z.coerce.number().int().positive().optional(),
      type: z.enum(LEDGER_ENTRY_TYPE_VALUES).optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be YYYY-MM-DD').optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be YYYY-MM-DD').optional(),
      page: z.coerce.number().int().positive().optional().default(1),
      pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
    })
    .strict(),
};

export const removeExpiredSchema = {
  params: z
    .object({
      batchId: z.coerce.number().int().positive(),
    })
    .strict(),
  body: z
    .object({
      reason: z.string().trim().max(300, 'Reason cannot exceed 300 characters').optional(),
    })
    .strict(),
};

export type ListBatchesQuery = z.infer<typeof listBatchesSchema.query>;
export type GetBatchParams = z.infer<typeof getBatchSchema.params>;
export type UpdateBatchParams = z.infer<typeof updateBatchSchema.params>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema.body>;
export type AdjustBatchParams = z.infer<typeof adjustBatchSchema.params>;
export type AdjustBatchInput = z.infer<typeof adjustBatchSchema.body>;
export type ListLedgerQuery = z.infer<typeof listLedgerSchema.query>;
export type RemoveExpiredParams = z.infer<typeof removeExpiredSchema.params>;
export type RemoveExpiredInput = z.infer<typeof removeExpiredSchema.body>;
