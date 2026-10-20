import { z } from 'zod';

export const listInvoicesQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from date must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to date must be in YYYY-MM-DD format')
    .optional(),
  retailerId: z.string().uuid('retailerId must be a valid UUID').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.coerce.number().int().positive('invoiceId must be a positive integer'),
});

export const resendInvoiceBodySchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
});
