import { z } from 'zod';

export const listAlertsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
  }),
};

export const dismissAlertSchema = {
  params: z.object({
    batchId: z.coerce.number().int().positive('Batch ID must be a positive integer'),
  }),
};

export type ListAlertsQuery = z.infer<typeof listAlertsSchema.query>;
export type DismissAlertParams = z.infer<typeof dismissAlertSchema.params>;
