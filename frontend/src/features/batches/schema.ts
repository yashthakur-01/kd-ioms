import { z } from 'zod';

export const adjustBatchFormSchema = z.object({
  type: z.enum(['DAMAGE', 'CORRECTION', 'EXPIRY_WRITEOFF'], {
    message: 'Please select an adjustment type',
  }),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .refine((n) => n !== 0, 'Quantity cannot be zero'),
  reason: z
    .string()
    .trim()
    .min(5, 'Reason must be at least 5 characters')
    .max(300, 'Reason cannot exceed 300 characters'),
});

export type AdjustBatchFormData = z.infer<typeof adjustBatchFormSchema>;
