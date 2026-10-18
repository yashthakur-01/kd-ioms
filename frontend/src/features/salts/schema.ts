import { z } from 'zod';

export const createSaltSchema = z.object({
  saltName: z
    .string()
    .trim()
    .min(2, 'Salt name must be at least 2 characters')
    .max(120, 'Salt name cannot exceed 120 characters')
    .regex(/^[A-Za-z0-9\s\-(),.]+$/, 'Salt name contains invalid characters (letters, numbers, space, -, (), , . allowed)'),
  confirmSimilar: z.boolean().default(false),
});

export type CreateSaltFormValues = z.infer<typeof createSaltSchema>;

export const updateSaltSchema = z.object({
  saltName: z
    .string()
    .trim()
    .min(2, 'Salt name must be at least 2 characters')
    .max(120, 'Salt name cannot exceed 120 characters')
    .regex(/^[A-Za-z0-9\s\-(),.]+$/, 'Salt name contains invalid characters')
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSaltFormValues = z.infer<typeof updateSaltSchema>;
