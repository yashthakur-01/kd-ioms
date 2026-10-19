import { z } from 'zod';

export const resolveScanSchema = z.object({
  payload: z.string().trim().min(1, 'Payload is required').max(2000, 'Payload cannot exceed 2000 characters'),
  medicineId: z.coerce.number().int().positive('medicineId must be a positive integer').optional(),
});

export type ResolveScanInput = z.infer<typeof resolveScanSchema>;
